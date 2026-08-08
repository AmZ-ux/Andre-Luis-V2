import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { upload, getUploadsDir } from '../middleware/upload.js'
import { requireAdmin } from '../middleware/roles.js'
import { todayBR } from '../services/paymentService.js'

const router = Router()

router.get('/', requireAdmin, (req, res) => {
  const db = getDb()
  const { search = '', status = '', month = '', year = '', transportType = '', page = '1', pageSize = '15', sortField = 'created_at', sortDirection = 'desc' } = req.query

  let sql = 'SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE 1=1'
  const params: any[] = []
  if (search) { sql += ' AND (passenger_name LIKE ? OR cpf LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (month) { sql += ' AND month = ?'; params.push(Number(month)) }
  if (year) { sql += ' AND year = ?'; params.push(Number(year)) }
  if (transportType) { sql += ' AND transport_type = ?'; params.push(transportType) }

  const wherePart = sql.includes('AND') ? sql.slice(sql.indexOf('AND')) : ''
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM receipts WHERE 1=1 ${wherePart}`).get(...params) as any
  const total = countResult?.total || 0

  const allowedSorts = ['passenger_name', 'created_at', 'amount', 'status']
  const field = allowedSorts.includes(sortField as string) ? sortField : 'created_at'
  const dir = sortDirection === 'desc' ? 'DESC' : 'ASC'
  const offset = (Number(page) - 1) * Number(pageSize)
  sql += ` ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
  params.push(Number(pageSize), offset)

  res.json({ data: db.prepare(sql).all(...params), total })
})

router.get('/summary', requireAdmin, (_req, res) => {
  const db = getDb()
  const rows = db.prepare("SELECT status, COUNT(*) as count FROM receipts GROUP BY status").all() as any[]
  const summary = { awaiting: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 }
  for (const r of rows) { summary[r.status as keyof typeof summary] = r.count; summary.total += r.count }
  res.json(summary)
})

router.get('/passenger/:passengerId', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const passengerId = req.user.role === 'admin' ? req.params.passengerId : req.user.userId
  const db = getDb()
  res.json(db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE passenger_id = ? ORDER BY created_at DESC").all(passengerId))
})

router.get('/download/:id', (req, res) => {
  const db = getDb()
  const receipt = db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, file_path, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id) as any
  if (!receipt) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }

  const isAdmin = req.user?.role === 'admin'
  const isOwner = req.user?.userId === receipt.passenger_id
  if (!req.user || (!isAdmin && !isOwner)) {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }

  if (receipt.file_path) {
    const filePath = path.join(getUploadsDir(), path.basename(receipt.file_path))
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', receipt.file_type || 'application/octet-stream')
      res.setHeader('Content-Disposition', `inline; filename="${receipt.file_name}"`)
      res.sendFile(filePath)
      return
    }
  }
  res.status(404).json({ error: 'Arquivo não encontrado' })
})

router.get('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const receipt = db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id)
  if (!receipt) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }
  const history = db.prepare('SELECT * FROM receipt_history WHERE receipt_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ receipt, history })
})

router.post('/', upload.single('file'), (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const file = req.file

  if (!file) {
    res.status(400).json({ error: 'Arquivo não enviado' })
    return
  }

  const {
    monthlyFeeId, passengerId, passengerName, cpf, transportType,
    institution, company, month, year, amount,
  } = req.body

  const id = uuid()
  const pid = req.user.role === 'admin' ? passengerId : req.user.userId

  db.prepare(`
    INSERT INTO receipts (id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, monthlyFeeId, pid, passengerName, cpf, transportType, institution || '', company || '', month, year, Number(amount), file.originalname, file.mimetype, file.size, file.path)

  db.prepare('INSERT INTO receipt_history (id, receipt_id, action, performed_by, performed_by_id) VALUES (?, ?, \'created\', ?, ?)')
    .run(uuid(), id, req.user.userId, req.user.userId)

  const created = db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, created_at, updated_at FROM receipts WHERE id = ?").get(id)
  res.status(201).json(created)
})

router.put('/:id/approve', requireAdmin, (req, res) => {
  const db = getDb()
  const { notes } = req.body
  const existing = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }
  if (existing.status === 'approved') { res.status(400).json({ error: 'Comprovante já aprovado' }); return }

  db.prepare('UPDATE receipts SET status = \'approved\', reviewed_by = ?, review_date = datetime(\'now\'), review_notes = ? WHERE id = ?')
    .run(req.user!.userId, notes || '', req.params.id)

  db.prepare("UPDATE monthly_fees SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(existing.monthly_fee_id)

  const existingPayment = db.prepare('SELECT id FROM payments WHERE monthly_fee_id = ?').get(existing.monthly_fee_id)
  if (!existingPayment) {
    db.prepare(`
      INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
      VALUES (?, ?, ?, ?, 'transfer', ?, 0, 0)
    `).run(uuid(), existing.monthly_fee_id, Number(existing.amount), todayBR(), 'Pagamento via comprovante aprovado')
  }

  db.prepare('INSERT INTO receipt_history (id, receipt_id, action, performed_by, performed_by_id, notes) VALUES (?, ?, \'approved\', ?, ?, ?)')
    .run(uuid(), req.params.id, req.user!.userId, req.user!.userId, notes || '')

  res.json(db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id))
})

router.put('/:id/reject', requireAdmin, (req, res) => {
  const db = getDb()
  const { reason } = req.body
  const existing = db.prepare('SELECT id FROM receipts WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }

  db.prepare('UPDATE receipts SET status = \'rejected\', reviewed_by = ?, review_date = datetime(\'now\'), review_notes = ? WHERE id = ?')
    .run(req.user!.userId, reason || '', req.params.id)

  db.prepare('INSERT INTO receipt_history (id, receipt_id, action, performed_by, performed_by_id, notes) VALUES (?, ?, \'rejected\', ?, ?, ?)')
    .run(uuid(), req.params.id, req.user!.userId, req.user!.userId, reason || '')

  res.json(db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id))
})

router.put('/:id/cancel', requireAdmin, (req, res) => {
  const db = getDb()
  const { reason } = req.body
  const existing = db.prepare('SELECT id FROM receipts WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }

  db.prepare('UPDATE receipts SET status = \'cancelled\', reviewed_by = ?, review_date = datetime(\'now\'), review_notes = ? WHERE id = ?')
    .run(req.user!.userId, reason || '', req.params.id)

  db.prepare('INSERT INTO receipt_history (id, receipt_id, action, performed_by, performed_by_id, notes) VALUES (?, ?, \'cancelled_analysis\', ?, ?, ?)')
    .run(uuid(), req.params.id, req.user!.userId, req.user!.userId, reason || '')

  res.json(db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id))
})

router.put('/:id/replace', upload.single('file'), (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const file = req.file
  const existing = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Comprovante não encontrado' }); return }

  const isAdmin = req.user.role === 'admin'
  const isOwner = req.user.userId === existing.passenger_id
  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }

  if (file) {
    // Remove old file from disk
    if (existing.file_path && fs.existsSync(existing.file_path)) {
      try { fs.unlinkSync(existing.file_path) } catch {}
    }

    db.prepare('UPDATE receipts SET file_name = ?, file_type = ?, file_size = ?, file_path = ?, status = \'awaiting\', updated_at = datetime(\'now\') WHERE id = ?')
      .run(file.originalname, file.mimetype, file.size, file.path, req.params.id)
  }

  db.prepare('INSERT INTO receipt_history (id, receipt_id, action, performed_by, performed_by_id) VALUES (?, ?, \'replaced\', ?, ?)')
    .run(uuid(), req.params.id, req.user!.userId, req.user!.userId)

  res.json(db.prepare("SELECT id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, file_name, file_type, file_size, status, reviewed_by, review_date, review_notes, created_at, updated_at FROM receipts WHERE id = ?").get(req.params.id))
})

export default router
