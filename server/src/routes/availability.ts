import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

// Aceita dd/mm/yyyy ou yyyy-mm-dd e normaliza para yyyy-mm-dd (ISO).
function parseIsoDate(value: string): string | null {
  const v = String(value || '').trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function toDate(value: string): Date | null {
  const iso = parseIsoDate(value)
  if (!iso) return null
  const d = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return isNaN(d.getTime()) ? null : d
}

// Converte qualquer formato aceito (ISO ou BR) para dd/mm/yyyy na resposta,
// preservando o contrato da API com o frontend.
function toBRDate(value: string | null | undefined): string {
  const iso = parseIsoDate(String(value || ''))
  if (!iso) return String(value || '')
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function decorateRow(row: any): any {
  if (!row) return row
  return { ...row, start_date: toBRDate(row.start_date), end_date: toBRDate(row.end_date) }
}

router.get('/', requireAdmin, (req, res) => {
  const db = getDb()
  const { search = '', status = '', type = '', transportType = '', page = '1', pageSize = '15', sortField = 'start_date', sortDirection = 'desc' } = req.query

  let sql = 'SELECT * FROM availabilities WHERE 1=1'
  const params: any[] = []
  if (search) { sql += ' AND (passenger_name LIKE ? OR cpf LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (type) { sql += ' AND type = ?'; params.push(type) }
  if (transportType) { sql += ' AND transport_type = ?'; params.push(transportType) }

  const wherePart = sql.includes('AND') ? sql.slice(sql.indexOf('AND')) : ''
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM availabilities WHERE 1=1 ${wherePart}`).get(...params) as any
  const total = countResult?.total || 0

  const allowedSorts = ['passenger_name', 'start_date', 'end_date', 'created_at']
  const field = allowedSorts.includes(sortField as string) ? sortField : 'start_date'
  const dir = sortDirection === 'desc' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)
  sql += ` ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
  params.push(Number(pageSize), offset)

  const data = db.prepare(sql).all(...params).map(decorateRow)
  res.json({ data, total })
})

router.get('/my', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  res.json(db.prepare('SELECT * FROM availabilities WHERE passenger_id = ? ORDER BY start_date DESC').all(req.user.userId).map(decorateRow))
})

router.get('/active', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  if (req.user.role === 'admin') {
    res.json(db.prepare("SELECT * FROM availabilities WHERE status IN ('scheduled', 'active')").all().map(decorateRow))
    return
  }
  res.json(db.prepare("SELECT * FROM availabilities WHERE passenger_id = ? AND status IN ('scheduled', 'active')").all(req.user.userId).map(decorateRow))
})

router.get('/summary', requireAdmin, (_req, res) => {
  const db = getDb()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const rows = db.prepare('SELECT status, start_date, end_date FROM availabilities').all() as any[]

  const parsed = rows.map((r) => ({
    status: r.status,
    start: toDate(r.start_date),
    end: toDate(r.end_date),
  })).filter((r) => r.start && r.end)

  const isSameDay = (d: Date, ref: Date) => d.getTime() === ref.getTime()

  res.json({
    onVacation: parsed.filter((r) => r.status === 'active').length,
    returningToday: parsed.filter((r) => r.status === 'active' && r.end && isSameDay(r.end, today)).length,
    startingToday: parsed.filter((r) => r.status === 'scheduled' && r.start && isSameDay(r.start, today)).length,
    future: parsed.filter((r) => r.status === 'scheduled').length,
    total: rows.length,
  })
})

router.get('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const av = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id)
  if (!av) { res.status(404).json({ error: 'Período não encontrado' }); return }
  const history = db.prepare('SELECT * FROM availability_history WHERE availability_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ availability: decorateRow(av), history })
})

router.post('/', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const { passengerName, cpf, transportType, institution, company, city, type, startDate, endDate, reason, notes, submittedBy, submittedById } = req.body

  const isAdmin = req.user.role === 'admin'
  const passengerId = isAdmin && req.body.passengerId ? req.body.passengerId : req.user.userId

  // Validação básica
  if (!startDate || !endDate) {
    res.status(400).json({ error: 'Data de início e fim são obrigatórias' })
    return
  }
  const startIso = parseIsoDate(startDate)
  const endIso = parseIsoDate(endDate)
  if (!startIso || !endIso) {
    res.status(400).json({ error: 'Datas inválidas. Use o formato dd/mm/aaaa ou aaaa-mm-dd' })
    return
  }
  const startDt = toDate(startIso)
  const endDt = toDate(endIso)
  if (!startDt || !endDt) {
    res.status(400).json({ error: 'Datas inválidas' })
    return
  }
  if (endDt < startDt) {
    res.status(400).json({ error: 'Data final deve ser maior ou igual à data inicial' })
    return
  }
  if (!isAdmin) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (startDt < today) {
      res.status(400).json({ error: 'Não é permitido criar períodos retroativos' })
      return
    }
  }

  // Impede períodos sobrepostos (scheduled/active) do mesmo passageiro
  const overlap = db.prepare(`
    SELECT id FROM availabilities
    WHERE passenger_id = ? AND status IN ('scheduled', 'active')
      AND start_date <= ? AND end_date >= ?
  `).get(passengerId, endIso, startIso) as any
  if (overlap) {
    res.status(400).json({ error: 'Período sobreposto com outro já cadastrado' })
    return
  }

  // Para passageiro, os dados vêm do próprio cadastro (não confia no body)
  let finalName = passengerName
  let finalCpf = cpf
  let finalTransportType = transportType
  if (!isAdmin) {
    const p = db.prepare('SELECT name, cpf, transport_type, institution, company, city FROM passengers WHERE id = ?').get(passengerId) as any
    finalName = p?.name || req.user.userId
    finalCpf = p?.cpf || ''
    finalTransportType = p?.transport_type || 'university'
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, institution, company, city, type, start_date, end_date, reason, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
  `).run(id, passengerId, finalName, finalCpf, finalTransportType, institution || '', company || '', city || '', type || 'vacation', startIso, endIso, reason || '', notes || '')

  db.prepare('INSERT INTO availability_history (id, availability_id, action, performed_by, performed_by_id) VALUES (?, ?, \'created\', ?, ?)')
    .run(uuid(), id, submittedBy || req.user.userId, submittedById || req.user.userId)

  res.status(201).json(decorateRow(db.prepare('SELECT * FROM availabilities WHERE id = ?').get(id)))
})

router.put('/:id/cancel', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const { reason, cancelledBy, cancelledById } = req.body
  const existing = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Período não encontrado' }); return }

  const isAdmin = req.user.role === 'admin'
  if (!isAdmin && existing.passenger_id !== req.user.userId) {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }

  db.prepare("UPDATE availabilities SET status = 'cancelled', cancelled_at = datetime('now'), cancellation_reason = ? WHERE id = ?").run(reason || '', req.params.id)
  db.prepare('INSERT INTO availability_history (id, availability_id, action, performed_by, performed_by_id, notes) VALUES (?, ?, \'cancelled\', ?, ?, ?)')
    .run(uuid(), req.params.id, cancelledBy || req.user.userId, cancelledById || req.user.userId, reason || '')

  res.json(decorateRow(db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id)))
})

export default router
