import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

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

  const data = db.prepare(sql).all(...params)
  res.json({ data, total })
})

router.get('/my', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  res.json(db.prepare('SELECT * FROM availabilities WHERE passenger_id = ? ORDER BY start_date DESC').all(req.user.userId))
})

router.get('/active', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  if (req.user.role === 'admin') {
    res.json(db.prepare("SELECT * FROM availabilities WHERE status IN ('scheduled', 'active')").all())
    return
  }
  res.json(db.prepare("SELECT * FROM availabilities WHERE passenger_id = ? AND status IN ('scheduled', 'active')").all(req.user.userId))
})

router.get('/summary', requireAdmin, (_req, res) => {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const [d, m, y] = today.split('-')
  const todayBR = `${d}/${m}/${y}`

  res.json({
    onVacation: (db.prepare('SELECT COUNT(*) as c FROM availabilities WHERE status = \'active\'').get() as any).c,
    returningToday: (db.prepare('SELECT COUNT(*) as c FROM availabilities WHERE status = \'active\' AND end_date = ?').get(todayBR) as any).c,
    startingToday: (db.prepare('SELECT COUNT(*) as c FROM availabilities WHERE status = \'scheduled\' AND start_date = ?').get(todayBR) as any).c,
    future: (db.prepare("SELECT COUNT(*) as c FROM availabilities WHERE status = 'scheduled'").get() as any).c,
    total: (db.prepare('SELECT COUNT(*) as c FROM availabilities').get() as any).c,
  })
})

router.get('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const av = db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id)
  if (!av) { res.status(404).json({ error: 'Período não encontrado' }); return }
  const history = db.prepare('SELECT * FROM availability_history WHERE availability_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ availability: av, history })
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
  `).run(id, passengerId, finalName, finalCpf, finalTransportType, institution || '', company || '', city || '', type || 'vacation', startDate, endDate, reason || '', notes || '')

  db.prepare('INSERT INTO availability_history (id, availability_id, action, performed_by, performed_by_id) VALUES (?, ?, \'created\', ?, ?)')
    .run(uuid(), id, submittedBy || req.user.userId, submittedById || req.user.userId)

  res.status(201).json(db.prepare('SELECT * FROM availabilities WHERE id = ?').get(id))
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

  res.json(db.prepare('SELECT * FROM availabilities WHERE id = ?').get(req.params.id))
})

export default router
