import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

function addLog(db: any, action: string, description: string, user: { userId: string; role: string }, category = 'general'): void {
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), action, description, user.role === 'admin' ? 'Administrador' : 'Passageiro', user.role, category)
}

router.get('/', (req, res) => {
  const db = getDb()
  res.json(loadSettings(db))
})

router.put('/:category', requireAdmin, (req, res) => {
  const db = getDb()
  const { category } = req.params
  const data = req.body

  const existing = db.prepare('SELECT id, data FROM settings WHERE category = ?').get(category)

  if (existing) {
    const parsedExisting = JSON.parse(existing.data)
    const parsedIncoming = data

    // Registrar alterações no audit_logs
    for (const [key, newVal] of Object.entries(parsedIncoming)) {
      const oldVal = parsedExisting[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        db.prepare(`
          INSERT INTO audit_logs (id, user_id, user_name, action, category, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uuid(),
          req.user!.userId,
          req.user!.role === 'admin' ? 'Administrador' : 'Passageiro',
          'settings_update',
          category,
          JSON.stringify({ field: key, previousValue: oldVal, newValue: newVal })
        )
      }
    }

    // Merge com os dados existentes para não perder campos não enviados
    const merged = { ...parsedExisting, ...parsedIncoming }
    db.prepare('UPDATE settings SET data = ?, updated_at = datetime(\'now\') WHERE category = ?').run(JSON.stringify(merged), category)
  } else {
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)').run(uuid(), category, JSON.stringify(data))
  }

  addLog(db, 'settings_update', `Configuração "${category}" alterada`, req.user, category)
  res.json(loadSettings(db))
})

// Audit logs
router.get('/audit', requireAdmin, (req, res) => {
  const db = getDb()
  const { page = '1', pageSize = '20' } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  const data = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(pageSize), offset)
  const total = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c
  res.json({ data, total })
})

// User management
router.get('/users', requireAdmin, (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT id, name, email, cpf, phone, role, created_at, last_access FROM users').all())
})

// Backup
const BACKUP_TABLES = ['passengers', 'monthly_fees', 'payments', 'receipts', 'receipt_history', 'availabilities', 'availability_history', 'messages', 'notifications', 'settings']

router.post('/backup', requireAdmin, (_req, res) => {
  const db = getDb()
  const backup: any = {}
  for (const table of BACKUP_TABLES) {
    backup[table] = db.prepare(`SELECT * FROM ${table}`).all()
  }
  const id = uuid()
  db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)').run(uuid(), `backup_${id}`, JSON.stringify(backup))
  addLog(db, 'backup_create', `Backup criado: ${id}`, _req.user!, 'backup')
  res.json({ id, timestamp: new Date().toISOString(), size: JSON.stringify(backup).length })
})

// Lista backups salvos
router.get('/backups', requireAdmin, (_req, res) => {
  const db = getDb()
  const rows = db.prepare("SELECT category, data, created_at FROM settings WHERE category LIKE 'backup_%' ORDER BY created_at DESC").all() as any[]
  res.json(rows.map((row: any) => {
    const id = row.category.replace('backup_', '')
    return {
      id,
      timestamp: row.created_at || new Date().toISOString(),
      size: row.data ? JSON.stringify(JSON.parse(row.data)).length : 0,
      type: 'manual',
    }
  }))
})

// Restaura um backup salvo
router.post('/backups/:id/restore', requireAdmin, (req, res) => {
  const db = getDb()
  const row = db.prepare('SELECT data FROM settings WHERE category = ?').get(`backup_${req.params.id}`) as any
  if (!row) {
    res.status(404).json({ error: 'Backup não encontrado' })
    return
  }

  let backup: any
  try {
    backup = JSON.parse(row.data)
  } catch {
    res.status(500).json({ error: 'Backup corrompido' })
    return
  }

  for (const table of BACKUP_TABLES) {
    db.prepare(`DELETE FROM ${table}`).run()
    for (const item of backup[table] || []) {
      const columns = Object.keys(item)
      const placeholders = columns.map(() => '?').join(', ')
      db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map((c) => item[c]))
    }
  }

  addLog(db, 'backup_restore', `Backup restaurado: ${req.params.id}`, req.user!, 'backup')
  res.json({ success: true })
})

// Remove um backup salvo
router.delete('/backups/:id', requireAdmin, (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM settings WHERE category = ?').run(`backup_${req.params.id}`)
  addLog(db, 'backup_delete', `Backup removido: ${req.params.id}`, req.user!, 'backup')
  res.status(204).end()
})

// Logs do sistema
router.get('/logs', requireAdmin, (req, res) => {
  const db = getDb()
  const { page = '1', pageSize = '50' } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  const data = db.prepare('SELECT * FROM app_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(pageSize), offset)
  const total = (db.prepare('SELECT COUNT(*) as c FROM app_logs').get() as any).c
  res.json({ data, total })
})

router.delete('/logs', requireAdmin, (_req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM app_logs').run()
  res.status(204).end()
})

export default router
