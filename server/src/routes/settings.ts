import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { requireAdmin } from '../middleware/roles.js'
import { addLog } from '../services/appLogService.js'
import { createBackup, listBackups, getBackupPath, restoreBackup, deleteBackup, pruneBackups, isValidBackupId } from '../services/backupService.js'

const router = Router()

router.get('/', (req, res) => {
  const db = getDb()
  res.json(loadSettings(db))
})

router.put('/:category', requireAdmin, (req, res) => {
  const db = getDb()
  const category = String(req.params.category)
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

  addLog(db, 'settings_update', `Configuração "${category}" alterada`, req.user!, category)
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

// Backup em arquivos reais (volume persistente)
router.post('/backup', requireAdmin, (_req, res) => {
  const db = getDb()
  const info = createBackup(db, 'manual')
  addLog(db, 'backup_create', `Backup manual criado: ${info.id}`, _req.user!, 'backup')
  res.json(info)
})

// Lista backups salvos
router.get('/backups', requireAdmin, (_req, res) => {
  res.json(listBackups())
})

// Download de um backup
router.get('/backups/:id/download', requireAdmin, (req, res) => {
  const filePath = getBackupPath(String(req.params.id))
  if (!filePath) {
    res.status(404).json({ error: 'Backup não encontrado' })
    return
  }
  res.download(filePath, `backup_${String(req.params.id)}.json`)
})

// Restaura um backup salvo
router.post('/backups/:id/restore', requireAdmin, (req, res) => {
  const id = String(req.params.id)
  if (!isValidBackupId(id)) {
    res.status(400).json({ error: 'ID de backup inválido' })
    return
  }
  const db = getDb()
  try {
    restoreBackup(db, id)
  } catch (err: any) {
    res.status(err.message === 'Backup não encontrado' ? 404 : 500).json({ error: err.message || 'Falha ao restaurar backup' })
    return
  }
  addLog(db, 'backup_restore', `Backup restaurado: ${id}`, req.user!, 'backup')
  res.json({ success: true })
})

// Remove um backup salvo
router.delete('/backups/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id)
  if (!isValidBackupId(id)) {
    res.status(400).json({ error: 'ID de backup inválido' })
    return
  }
  const db = getDb()
  deleteBackup(id)
  addLog(db, 'backup_delete', `Backup removido: ${id}`, req.user!, 'backup')
  pruneBackups(30)
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
