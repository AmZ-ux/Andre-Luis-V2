import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  res.json(loadSettings(db))
})

router.put('/:category', (req, res) => {
  const db = getDb()
  const { category } = req.params
  const data = req.body

  const existing = db.prepare('SELECT id FROM settings WHERE category = ?').get(category)
  if (existing) {
    db.prepare('UPDATE settings SET data = ?, updated_at = datetime(\'now\') WHERE category = ?').run(JSON.stringify(data), category)
  } else {
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)').run(uuid(), category, JSON.stringify(data))
  }

  res.json(loadSettings(db))
})

// Audit logs
router.get('/audit', (req, res) => {
  const db = getDb()
  const { page = '1', pageSize = '20' } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  const data = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(pageSize), offset)
  const total = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c
  res.json({ data, total })
})

// User management
router.get('/users', (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT id, name, email, cpf, phone, role, created_at, last_access FROM users').all())
})

// Backup
router.post('/backup', (_req, res) => {
  const db = getDb()
  const tables = ['passengers', 'monthly_fees', 'payments', 'receipts', 'receipt_history', 'availabilities', 'availability_history', 'messages', 'notifications', 'settings']
  const backup: any = {}
  for (const table of tables) {
    backup[table] = db.prepare(`SELECT * FROM ${table}`).all()
  }
  const id = uuid()
  db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)').run(uuid(), `backup_${id}`, JSON.stringify(backup))
  res.json({ id, timestamp: new Date().toISOString(), size: JSON.stringify(backup).length })
})

export default router
