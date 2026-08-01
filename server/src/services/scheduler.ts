import cron from 'node-cron'
import { getDb } from '../database/connection.js'
import { loadSettings } from './settingsService.js'
import { generateMonthlyFees } from './monthlyFeeGenerator.js'
import { markOverdueFees, sendPaymentReminders } from './feeAutomation.js'
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
  } catch (err) {
    logger.error({ err }, 'Daily automation task failed')
  }
}

function runMonthlyGeneration(): void {
  try {
    const db = getDb()
    const now = new Date()
    generateMonthlyFees({ month: now.getMonth() + 1, year: now.getFullYear() }, db)
  } catch (err) {
    logger.error({ err }, 'Monthly fee generation task failed')
  }
}

export function startScheduler(): void {
  if (started) return
  started = true

  cron.schedule('0 6 * * *', runDaily)
  cron.schedule('0 7 1 * *', runMonthlyGeneration)

  logger.info('Scheduler started (daily 06:00: overdue + reminders; monthly 1st 07:00: fee generation)')
}
