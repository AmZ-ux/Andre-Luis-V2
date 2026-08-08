import cron from 'node-cron'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from './settingsService.js'
import { ensureContractFees } from './monthlyFeeGenerator.js'
import { markOverdueFees, sendPaymentReminders, buildDailySummary, notifyDailySummaryToAdmins } from './feeAutomation.js'
import { createBackup, pruneBackups, uploadBackupOffsite } from './backupService.js'
import { searchPaymentByExternalReference, mpStatus } from './mercadopagoService.js'
import { finalizePayment } from './paymentService.js'
import { alertIntegrationIssue } from './integrationAlert.js'
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
    uploadBackupOffsite(info.id)
      .then((uploaded: boolean) => {
        if (uploaded) logger.info({ id: info.id }, 'Backup uploaded off-site')
        else logger.warn({ id: info.id }, 'Off-site backup skipped (S3 not configured)')
      })
      .catch((err: any) => {
        logger.error({ err, id: info.id }, 'Off-site backup upload failed')
        alertIntegrationIssue(db, 'S3/R2', `Falha no envio do backup ${info.id} para o armazenamento off-site: ${err.message}`)
      })
  } catch (err) {
    logger.error({ err }, 'Automatic backup task failed')
  }
}

// Reconcilia cobrancas pendentes com o Mercado Pago: pagamentos confirmados fora
// da sessao (aba fechada, timeout) sao finalizados e cobrancas canceladas marcadas.
export async function runPaymentReconciliation(): Promise<void> {
  const db = getDb()
  try {
    // Ignora cobrancas recentes (< 10 min): o polling do checkout ja cuida delas
    const charges = db.prepare(`
      SELECT * FROM pix_charges
      WHERE status = 'pending' AND created_at <= datetime('now', '-10 minutes')
      ORDER BY created_at ASC LIMIT 20
    `).all() as any[]
    if (charges.length === 0) return

    for (const charge of charges) {
      try {
        const expiryHours = Number(process.env.MP_PIX_EXPIRY_HOURS) || 24
        const expiredLocal = db.prepare("SELECT 1 FROM pix_charges WHERE id = ? AND created_at <= datetime('now', ?)").get(charge.id, `-${expiryHours} hours`)
        const payment = await searchPaymentByExternalReference(String(charge.monthly_fee_id))
        if (!payment) {
          if (expiredLocal) {
            db.prepare("UPDATE pix_charges SET status = 'expired', updated_at = datetime('now') WHERE id = ?").run(charge.id)
            logger.info({ chargeId: charge.id }, 'Charge marked as expired (no payment found after PIX expiry)')
          }
          continue
        }
        const status = mpStatus(payment.status)
        if (status === 'paid') {
          const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(charge.monthly_fee_id) as any
          if (fee && fee.status !== 'paid') {
            finalizePayment(
              db,
              fee,
              String(payment.id),
              Number(payment.transaction_amount ?? 0),
              payment.payment_method_id === 'pix' ? 'pix' : 'card',
              charge.id
            )
          } else if (fee) {
            db.prepare("UPDATE pix_charges SET status = 'succeeded', updated_at = datetime('now') WHERE id = ?").run(charge.id)
          }
        } else if (status === 'cancelled') {
          db.prepare("UPDATE pix_charges SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(charge.id)
        }
      } catch (err: any) {
        logger.error({ chargeId: charge.id, err: err.message }, 'Payment reconciliation check failed')
        alertIntegrationIssue(db, 'Mercado Pago', `Falha na conciliação da cobrança ${charge.id}: ${err.message}`)
      }
    }
  } catch (err) {
    logger.error({ err }, 'Payment reconciliation task failed')
  }
}

export function startScheduler(): void {
  if (started) return
  started = true

  cron.schedule('0 2 * * *', runAutoBackup, { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 8 * * *', runDaily, { timezone: 'America/Sao_Paulo' })
  cron.schedule('0 9 * * *', runContractGeneration, { timezone: 'America/Sao_Paulo' })
  cron.schedule('*/10 * * * *', () => { runPaymentReconciliation() }, { timezone: 'America/Sao_Paulo' })

  logger.info('Scheduler started (02:00 BRT: auto backup; 08:00 BRT: overdue + reminders; 09:00 BRT: fee generation per contract; */10: payment reconciliation)')
}
