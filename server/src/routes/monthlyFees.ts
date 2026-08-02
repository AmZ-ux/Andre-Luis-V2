import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { generateMonthlyFees } from '../services/monthlyFeeGenerator.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import { notifyPaymentReceived } from '../services/feeAutomation.js'

const router = Router()

function requireAdmin(req: any, res: any): boolean {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return false }
  if (req.user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores' }); return false }
  return true
}

// Garante a mensalidade do mes corrente para o passageiro autenticado,
// criando-a sob demanda (regras de inatividade/ferias) se ainda nao existir.
router.post('/ensure-current', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  if (req.user.role !== 'passenger') { res.status(403).json({ error: 'Apenas passageiros' }); return }

  const db = getDb()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const existing = db.prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?')
    .get(req.user.userId, month, year) as any
  if (existing) {
    const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(existing.id)
    res.json({ ...existing, payment: payment || null, ensured: false })
    return
  }

  const result = generateMonthlyFees({ month, year, passengerIds: [req.user.userId] }, db)
  const created = db.prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?')
    .get(req.user.userId, month, year) as any

  if (!created) {
    res.status(400).json({ error: 'Mensalidade indisponível para este mês' })
    return
  }

  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(created.id)
  res.status(201).json({ ...created, payment: payment || null, ensured: true, skipped: result.skippedInactive + result.skippedVacation })
})

router.get('/', (req, res) => {
  const db = getDb()
  const { search = '', month = '', year = '', status = '', transportType = '', page = '1', pageSize = '15', sortField = 'created_at', sortDirection = 'desc' } = req.query

  let sql = 'SELECT mf.*, p.city FROM monthly_fees mf LEFT JOIN passengers p ON p.id = mf.passenger_id WHERE 1=1'
  const params: any[] = []

  if (search) { sql += ' AND (mf.passenger_name LIKE ? OR mf.cpf LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (month) { sql += ' AND mf.month = ?'; params.push(Number(month)) }
  if (year) { sql += ' AND mf.year = ?'; params.push(Number(year)) }
  if (status) { sql += ' AND mf.status = ?'; params.push(status) }
  if (transportType) { sql += ' AND mf.transport_type = ?'; params.push(transportType) }

  const wherePart = sql.includes('AND') ? sql.slice(sql.indexOf('AND')) : ''
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM monthly_fees mf WHERE 1=1 ${wherePart}`).get(...params) as any
  const total = countResult?.total || 0

  const allowedSorts = ['passenger_name', 'amount', 'due_day', 'payment_date', 'created_at']
  const field = allowedSorts.includes(sortField as string) ? sortField : 'created_at'
  const dir = sortDirection === 'desc' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)

  sql += ` ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
  params.push(Number(pageSize), offset)

  const data = db.prepare(sql).all(...params)
  res.json({ data, total })
})

router.get('/:id', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id) as any
  if (!fee) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }

  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(req.params.id)
  res.json({ ...fee, payment: payment || null })
})

router.post('/', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const { passengerId, passengerName, cpf, transportType, institution, company, month, year, amount, dueDay } = req.body
  const id = uuid()
  const dueDate = `${String(dueDay || 1).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`

  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, passengerId, passengerName, cpf, transportType, institution || '', company || '', month, year, amount, dueDay || 5, dueDate)

  res.status(201).json(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(id))
})

router.put('/:id', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const existing = db.prepare('SELECT id FROM monthly_fees WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }

  const { amount, dueDay, notes, status } = req.body
  const sets: string[] = ['updated_at = datetime(\'now\')']
  const params: any[] = []
  if (amount !== undefined) { sets.push('amount = ?'); params.push(Number(amount)) }
  if (dueDay !== undefined) { sets.push('due_day = ?'); params.push(Number(dueDay)) }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }

  params.push(req.params.id)
  db.prepare(`UPDATE monthly_fees SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  res.json(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id))
})

router.post('/:id/pay', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const { amount, paymentDate, paymentMethod, notes } = req.body
  const existing = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }

  if (existing.status === 'paid') { res.status(400).json({ error: 'Pagamento já registrado para esta mensalidade' }); return }
  if (existing.status === 'cancelled') { res.status(400).json({ error: 'Não é possível registrar pagamento para uma mensalidade cancelada' }); return }
  if (existing.status === 'exempt') { res.status(400).json({ error: 'Não é possível registrar pagamento para uma mensalidade isenta' }); return }

  const settings = loadSettings(db)
  const breakdown = calculateDueFromFee(existing, settings, new Date())
  const payAmount = amount !== undefined && amount !== null ? Number(amount) : breakdown.total

  if (!paymentDate || !paymentMethod) {
    res.status(400).json({ error: 'Dados de pagamento incompletos (data e forma são obrigatórios)' })
    return
  }

  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payId,
    req.params.id,
    payAmount,
    paymentDate,
    paymentMethod,
    notes || '',
    breakdown.lateFee,
    breakdown.interest
  )

  db.prepare('UPDATE monthly_fees SET status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id)

  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(req.params.id)

  notifyPaymentReceived(db, fee, payment)

  res.json({ ...fee, payment, breakdown })
})

router.get('/passenger/:passengerId', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const isAdmin = req.user.role === 'admin'
  const passengerId = isAdmin ? req.params.passengerId : req.user.userId
  const db = getDb()
  const data = db.prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? ORDER BY year DESC, month DESC').all(passengerId)
  res.json(data)
})

router.delete('/:id', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const existing = db.prepare('SELECT id FROM monthly_fees WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }
  db.prepare('DELETE FROM payments WHERE monthly_fee_id = ?').run(req.params.id)
  db.prepare('DELETE FROM monthly_fees WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

export default router
