import cron from 'node-cron'
import { getDb } from '../database/connection.js'
import { loadSettings } from './settingsService.js'
import { ensureContractFees } from './monthlyFeeGenerator.js'
import { markOverdueFees, sendPaymentReminders, buildDailySummary, notifyDailySummaryToAdmins } from './feeAutomation.js'
import { logger } from '../utils/logger.js'

let started = false

function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function runDaily(): void {
  try {
    const db = getDb()
    const settings = loadSettings(db)
    markOverdueFees(db, settings, today())
    sendPaymentReminders(db, settings, today())
    notifyDailySummaryToAdmins(db, buildDailySummary(db))
  } catch (err) {
    logger.error({ err }, 'Daily automation task failed')
  }
}

// Gera as mensalidades de cada passageiro conforme o proprio contrato
// (primeiro ciclo = mes seguinte ao inicio; demais, um por mes ate o atual).
function runContractGeneration(): void {
  try {
    const db = getDb()
    const passengers = db.prepare("SELECT id FROM passengers WHERE status = 'active'").all() as any[]
    for (const p of passengers) {
      ensureContractFees(p.id, db)
    }
  } catch (err) {
    logger.error({ err }, 'Contract fee generation task failed')
  }
}

export function startScheduler(): void {
  if (started) return
  started = true

  cron.schedule('0 6 * * *', runDaily)
  cron.schedule('0 7 * * *', runContractGeneration)

  logger.info('Scheduler started (daily 06:00: overdue + reminders; daily 07:00: fee generation per contract)')
}
