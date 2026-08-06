import cron from 'node-cron'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from './settingsService.js'
import { ensureContractFees } from './monthlyFeeGenerator.js'
import { markOverdueFees, sendPaymentReminders, buildDailySummary, notifyDailySummaryToAdmins } from './feeAutomation.js'
import { createBackup, pruneBackups } from './backupService.js'
import { logger } from '../utils/logger.js'
import { addLog } from './appLogService.js'

let started = false

function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function todayStr(): string {
  const t = today()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Claim atomico por dia: impede que multiplas instancias/restarts executem a mesma tarefa diaria 2x */
function claimDaily(key: string, dateStr: string): boolean {
  const db = getDb()
  const category = `scheduler_${key}`
  const row = db.prepare('SELECT data FROM settings WHERE category = ?').get(category) as any
  const newData = JSON.stringify({ lastRun: dateStr })
  if (!row) {
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
      .run(uuid(), category, newData)
    return true
  }
  const result = db.prepare('UPDATE settings SET data = ? WHERE category = ? AND data = ?')
    .run(newData, category, row.data)
  return result.changes > 0
}

function runDaily(): void {
  const db = getDb()
  if (!claimDaily('daily_automation', todayStr())) return
  try {
    const settings = loadSettings(db)
    markOverdueFees(db, settings, today())
    sendPaymentReminders(db, settings, today())
    notifyDailySummaryToAdmins(db, buildDailySummary(db))
  } catch (err) {
    logger.error({ err }, 'Daily automation task failed')
  }
}

// Gera as mensalidades de cada passageiro conforme o proprio contrato
// (primeiro ciclo = mes do inicio do contrato; demais, um por mes ate o atual).
function runContractGeneration(): void {
  const db = getDb()
  if (!claimDaily('contract_generation', todayStr())) return
  try {
    const passengers = db.prepare("SELECT id FROM passengers WHERE status = 'active'").all() as any[]
    for (const p of passengers) {
      ensureContractFees(p.id, db)
    }
  } catch (err) {
    logger.error({ err }, 'Contract fee generation task failed')
  }
}

function runAutoBackup(): void {
  const db = getDb()
  if (!claimDaily('auto_backup', todayStr())) return
  try {
    const info = createBackup(db, 'automatic')
    addLog(db, 'backup_create', `Backup automático criado: ${info.id}`, { userId: 'scheduler', role: 'admin' }, 'backup')
    pruneBackups(30)
    logger.info({ id: info.id, size: info.size }, 'Automatic backup created')
  } catch (err) {
    logger.error({ err }, 'Automatic backup task failed')
  }
}

export function startScheduler(): void {
  if (started) return
  started = true

  cron.schedule('0 2 * * *', runAutoBackup, { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 8 * * *', runDaily, { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 9 * * *', runContractGeneration, { timezone: 'America/Sao_Paulo' })

  logger.info('Scheduler started (02:00 BRT: auto backup; 08:00 BRT: overdue + reminders; 09:00 BRT: fee generation per contract)')
}
