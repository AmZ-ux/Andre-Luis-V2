import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { ensureContractFees } from '../services/monthlyFeeGenerator.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import { markOverdueFees, notifyPaymentReceived } from '../services/feeAutomation.js'
import { requireAdmin as requireAdminRole } from '../middleware/roles.js'

const router = Router()

function requireAdmin(req: any, res: any): boolean {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return false }
  if (req.user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores' }); return false }
  return true
}

// Garante a serie de mensalidades do passageiro autenticado a partir do seu
// contrato (primeira competencia = mes do inicio do contrato), criando sob
// demanda os ciclos ja vencidos que ainda nao existem. O admin nao gera mensalidades.
router.post('/ensure-current', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  if (req.user.role !== 'passenger') { res.status(403).json({ error: 'Apenas passageiros' }); return }

  const db = getDb()
  const result = ensureContractFees(req.user.userId, db)

  const fees = db.prepare(`
    SELECT mf.* FROM monthly_fees mf
    WHERE mf.passenger_id = ?
    ORDER BY mf.year ASC, mf.month ASC
  `).all(req.user.userId) as any[]

  const next = fees.find((f) => f.status === 'pending' || f.status === 'overdue') || fees[fees.length - 1] || null

  res.json({
    created: result.created,
    ensured: result.created > 0,
    next: next
      ? { ...next, payment: db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(next.id) || null }
      : null,
  })
})

router.get('/', requireAdminRole, (req, res) => {
  const db = getDb()
  // Sincroniza status pendente -> vencida antes de ler, para a listagem e os
  // filtros nunca mostrarem mensalidade atrasada como "Pendente".
  markOverdueFees(db)
  const { search = '', month = '', year = '', status = '', transportType = '', page = '1', pageSize = '15', sortField = 'created_at', sortDirection = 'desc' } = req.query

  let sql = `SELECT mf.*, p.city,
      pay.id AS payment_id, pay.amount AS payment_amount,
      pay.payment_date AS payment_payment_date, pay.payment_method AS payment_payment_method,
      pay.notes AS payment_notes, pay.created_at AS payment_created_at,
      pay.receipt AS payment_receipt, pay.receipt_status AS payment_receipt_status, pay.late_fee AS payment_late_fee, pay.interest AS payment_interest
    FROM monthly_fees mf
    LEFT JOIN passengers p ON p.id = mf.passenger_id
    LEFT JOIN payments pay ON pay.monthly_fee_id = mf.id
    WHERE 1=1`
  const params: any[] = []

  if (search) { sql += ' AND (mf.passenger_name LIKE ? OR mf.cpf LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (month) { sql += ' AND mf.month = ?'; params.push(Number(month)) }
  if (year) { sql += ' AND mf.year = ?'; params.push(Number(year)) }
  if (status) { sql += ' AND mf.status = ?'; params.push(status) }
  if (transportType) { sql += ' AND mf.transport_type = ?'; params.push(transportType) }

  const wherePart = sql.includes('AND') ? sql.slice(sql.indexOf('AND')) : ''
  const summarySql = `SELECT
      COUNT(*) as total,
      COALESCE(SUM(amount), 0) as expected,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as received,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as overdue,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paidCount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pendingCount,
      COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) as overdueCount
    FROM monthly_fees mf WHERE 1=1 ${wherePart}`
  const summary = db.prepare(summarySql).get(...params) as any
  const countResult = summary
  const total = countResult?.total || 0

  const allowedSorts = ['passenger_name', 'amount', 'due_day', 'payment_date', 'created_at']
  const field = allowedSorts.includes(sortField as string) ? sortField : 'created_at'
  const dir = sortDirection === 'desc' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)

  sql += ` ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
  params.push(Number(pageSize), offset)

  const rows = db.prepare(sql).all(...params) as any[]
  const data = rows.map((r) => {
    const {
      payment_id, payment_amount, payment_payment_date, payment_payment_method,
      payment_notes, payment_created_at, payment_receipt, payment_receipt_status, payment_late_fee, payment_interest,
      ...rest
    } = r
    const payment = payment_id
      ? {
          id: payment_id,
          amount: payment_amount,
          payment_date: payment_payment_date,
          payment_method: payment_payment_method,
          notes: payment_notes || '',
          created_at: payment_created_at,
          receipt: payment_receipt || '',
          receipt_status: payment_receipt_status || 'none',
          late_fee: payment_late_fee,
          interest: payment_interest,
        }
      : null
    return { ...rest, payment }
  })
  res.json({
    data,
    total,
    summary: {
      expected: summary?.expected || 0,
      received: summary?.received || 0,
      pending: summary?.pending || 0,
      overdue: summary?.overdue || 0,
      paidCount: summary?.paidCount || 0,
      pendingCount: summary?.pendingCount || 0,
      overdueCount: summary?.overdueCount || 0,
    },
  })
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

  const monthNum = Number(month)
  const yearNum = Number(year)
  const amountNum = Number(amount)
  const dueDayNum = Number(dueDay || 5)

  if (!passengerId) { res.status(400).json({ error: 'Passageiro é obrigatório' }); return }
  if (!passengerName || !cpf || !transportType) { res.status(400).json({ error: 'Dados do passageiro incompletos' }); return }
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) { res.status(400).json({ error: 'Mês inválido' }); return }
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) { res.status(400).json({ error: 'Ano inválido' }); return }
  if (!Number.isFinite(amountNum) || amountNum <= 0) { res.status(400).json({ error: 'Valor da mensalidade inválido' }); return }
  if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) { res.status(400).json({ error: 'Dia de vencimento inválido' }); return }

  const passenger = db.prepare('SELECT id FROM passengers WHERE id = ?').get(passengerId)
  if (!passenger) { res.status(404).json({ error: 'Passageiro não encontrado' }); return }

  const dup = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?').get(passengerId, monthNum, yearNum)
  if (dup) { res.status(409).json({ error: 'Mensalidade já existe para este passageiro no período' }); return }

  const id = uuid()
  const dueDate = `${String(dueDayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${yearNum}`

  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, passengerId, passengerName, cpf, transportType, institution || '', company || '', monthNum, yearNum, amountNum, dueDayNum, dueDate)

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
  if (amount !== undefined) {
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) { res.status(400).json({ error: 'Valor da mensalidade inválido' }); return }
    sets.push('amount = ?'); params.push(amountNum)
  }
  if (dueDay !== undefined) {
    const dueDayNum = Number(dueDay)
    if (!Number.isInteger(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) { res.status(400).json({ error: 'Dia de vencimento inválido' }); return }
    sets.push('due_day = ?'); params.push(dueDayNum)
  }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes) }
  if (status !== undefined) { sets.push('status = ?'); params.push(status) }

  params.push(req.params.id)
  db.prepare(`UPDATE monthly_fees SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  res.json(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id))
})

router.post('/:id/pay', (req, res) => {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const { amount, paymentDate, paymentMethod, notes, receipt } = req.body
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

  // Comprovante opcional: URL do upload (/api/receipts/...) ou data URL legado (máx. ~3MB)
  let receiptValue = ''
  if (receipt !== undefined && receipt !== null && receipt !== '') {
    const raw = String(receipt)
    if (raw.length > 3 * 1024 * 1024) {
      res.status(400).json({ error: 'Comprovante muito grande (máximo 3MB)' })
      return
    }
    receiptValue = raw
  }

  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, receipt, receipt_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payId,
    req.params.id,
    payAmount,
    paymentDate,
    paymentMethod,
    notes || '',
    breakdown.lateFee,
    breakdown.interest,
    receiptValue,
    receiptValue ? 'pending' : 'none'
  )

  db.prepare('UPDATE monthly_fees SET status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id)

  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(req.params.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(req.params.id)

  const payer = req.user ? db.prepare('SELECT name, role FROM users WHERE id = ?').get(req.user.userId) as any : null
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'payment', `Pagamento de R$ ${Number(payAmount).toFixed(2)} registrado`, payer?.name || 'Administrador', payer?.role || 'admin', 'payment')

  notifyPaymentReceived(db, fee, payment)

  res.json({ ...fee, payment, breakdown })
})

router.get('/passenger/:passengerId', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const isAdmin = req.user.role === 'admin'
  const passengerId = isAdmin ? req.params.passengerId : req.user.userId
  const db = getDb()
  markOverdueFees(db)
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
