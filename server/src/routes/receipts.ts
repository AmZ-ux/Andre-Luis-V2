import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { uploadReceipt, UPLOADS_DIR } from '../middleware/upload.js'
import { logger } from '../utils/logger.js'

const router = Router()

function requireAdmin(req: any, res: any): boolean {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return false }
  if (req.user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores' }); return false }
  return true
}

// Upload de comprovante (multipart, campo "file") — qualquer usuário autenticado.
// Retorna a URL protegida para anexar ao pagamento.
router.post('/', uploadReceipt.single('file'), (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'Nenhum arquivo enviado' }); return }
  const url = `/receipts/${req.file.filename}`
  logger.info({ filename: req.file.filename, size: req.file.size }, 'Receipt uploaded')
  res.status(201).json({ url, filename: req.file.filename })
})

// Download protegido por autenticação (o comprovante não fica em pasta pública)
router.get('/:filename', (req, res) => {
  const filename = String(req.params.filename)
  if (!/^[a-f0-9-]+\.(jpg|png|pdf)$/i.test(filename)) {
    res.status(400).json({ error: 'Arquivo inválido' })
    return
  }
  const base = path.resolve(UPLOADS_DIR)
  const filePath = path.resolve(base, filename)
  if (!filePath.startsWith(base + path.sep) || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Arquivo não encontrado' })
    return
  }
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg'
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.sendFile(filePath)
})

function updateReceiptStatus(req: any, res: any, status: 'approved' | 'rejected'): void {
  if (!requireAdmin(req, res)) return
  const db = getDb()
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.paymentId) as any
  if (!payment) { res.status(404).json({ error: 'Pagamento não encontrado' }); return }
  if (!payment.receipt) { res.status(400).json({ error: 'Pagamento não possui comprovante' }); return }

  db.prepare('UPDATE payments SET receipt_status = ? WHERE id = ?').run(status, payment.id)

  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(payment.monthly_fee_id) as any
  const admin = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.userId) as any
  const actionLabel = status === 'approved' ? 'aprovado' : 'rejeitado'
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'receipt', `Comprovante ${actionLabel} (${fee?.passenger_name || ''} - ${String(payment.monthly_fee_id)})`, admin?.name || 'Administrador', 'admin', 'payment')

  logger.info({ paymentId: payment.id, status }, `Receipt ${status}`)
  res.json({ success: true, receiptStatus: status })
}

router.post('/:paymentId/approve', (req, res) => {
  updateReceiptStatus(req, res, 'approved')
})

router.post('/:paymentId/reject', (req, res) => {
  updateReceiptStatus(req, res, 'rejected')
})

export default router