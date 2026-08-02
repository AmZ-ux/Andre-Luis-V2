import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb, saveDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'

// TEMPORÁRIO: limpeza única dos dados de teste em produção.
// Remover este arquivo e a montagem em index.ts após o uso.

const TEST_EMAILS = [
  'lenovo.teste2026@mail.com',
  'passageiro@email.com',
  'maria.silva@email.com',
  'carlos.oliveira@email.com',
  'ana.santos@email.com',
  'pedro.costa@email.com',
  'julia.pereira@email.com',
]

const router = Router()

router.post('/cleanup-test-data', authMiddleware, (req, res) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Apenas administradores' })
    return
  }
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: 'Envie confirm: true para executar a limpeza' })
    return
  }

  const db = getDb()
  const result: Record<string, number | boolean> = {}

  const users = db.prepare('SELECT id FROM users WHERE email IN (SELECT value FROM json_each(?))').all(JSON.stringify(TEST_EMAILS)) as { id: string }[]
  const ids = users.map((u) => u.id)

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ')
    db.prepare(`DELETE FROM payments WHERE monthly_fee_id IN (SELECT id FROM monthly_fees WHERE passenger_id IN (${placeholders}))`).run(...ids)
    db.prepare(`DELETE FROM monthly_fees WHERE passenger_id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM receipts WHERE passenger_id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM receipt_history WHERE receipt_id IN (SELECT id FROM receipts WHERE passenger_id IN (${placeholders}))`).run(...ids)
    db.prepare(`DELETE FROM availabilities WHERE passenger_id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM availability_history WHERE availability_id IN (SELECT id FROM availabilities WHERE passenger_id IN (${placeholders}))`).run(...ids)
    db.prepare(`DELETE FROM notifications WHERE user_id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM pix_charges WHERE monthly_fee_id IN (SELECT id FROM monthly_fees WHERE passenger_id IN (${placeholders}))`).run(...ids)
    db.prepare(`DELETE FROM passengers WHERE id IN (${placeholders})`).run(...ids)
    db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids)
  }
  result.usersRemoved = ids.length
  // O admin@transporte.com vira o super admin (criador do projeto).
  const superAdmin = db.prepare('SELECT id FROM users WHERE role = ? AND email = ?').get('admin', 'admin@transporte.com') as { id: string } | undefined
  if (superAdmin) {
    if (req.body?.newAdminEmail && typeof req.body.newAdminEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.newAdminEmail)) {
      db.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').run(req.body.newAdminEmail.trim().toLowerCase(), superAdmin.id)
      result.adminEmailChanged = true
    }
    db.prepare('UPDATE users SET super_admin = 1, email_verified = 1 WHERE id = ?').run(superAdmin.id)
    result.superAdminReady = true
  }

  if (req.body?.newAdminPassword && typeof req.body.newAdminPassword === 'string' && req.body.newAdminPassword.length >= 8) {
    db.prepare('UPDATE users SET password_hash = ? WHERE role = ? AND super_admin = 1')
      .run(bcrypt.hashSync(req.body.newAdminPassword, 10), 'admin')
    result.adminPasswordChanged = true
  }

  saveDb()
  res.json({ success: true, ...result })
})

export default router
