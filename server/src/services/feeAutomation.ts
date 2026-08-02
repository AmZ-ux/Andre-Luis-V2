import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings, type AppSettings } from './settingsService.js'
import { buildDueDate, daysLate, calculateDueFromFee } from './billingRules.js'
import { whatsappService } from './whatsapp.js'
import { pushService } from './push.js'
import { getAdminIds } from './notificationService.js'
import { logger } from '../utils/logger.js'

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDueDate(fee: any): string {
  return `${String(fee.due_day).padStart(2, '0')}/${String(fee.month).padStart(2, '0')}/${fee.year}`
}

function addNotification(db: any, userId: string, title: string, message: string, link = ''): void {
  db.prepare('INSERT INTO notifications (id, user_id, title, message, status, type, link) VALUES (?, ?, ?, ?, \'unread\', \'info\', ?)')
    .run(uuid(), userId, title, message, link)
}

export function markOverdueFees(db: any = getDb(), settings: AppSettings = loadSettings(db), today: Date = new Date()): number {
  const tolerance = Math.max(0, Number(settings.billing.toleranceDays) || 0)
  const pending = db.prepare(`
    SELECT * FROM monthly_fees
    WHERE status = 'pending'
    AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.monthly_fee_id = monthly_fees.id)
  `).all() as any[]

  let updated = 0
  for (const fee of pending) {
    const due = buildDueDate(Number(fee.year), Number(fee.month), Number(fee.due_day))
    if (daysLate(due, today) > tolerance) {
      db.prepare("UPDATE monthly_fees SET status = 'overdue', updated_at = datetime('now') WHERE id = ?").run(fee.id)
      updated++
    }
  }

  if (updated > 0) logger.info({ updated }, 'Fees marked as overdue')
  return updated
}

export interface ReminderResult {
  remindersSent: number
  autoMessagesDisabled: boolean
}

function buildMessage(fee: any, settings: AppSettings, today: Date): string {
  const monthName = MONTH_NAMES[Number(fee.month) - 1] || String(fee.month)
  const due = buildDueDate(Number(fee.year), Number(fee.month), Number(fee.due_day))
  const late = daysLate(due, today)
  const breakdown = calculateDueFromFee(fee, settings, today)
  const dueDate = formatDueDate(fee)
  const signature = settings.communication.signature

  let msg: string
  if (late > 0) {
    const extras = breakdown.lateFee + breakdown.interest > 0
      ? ` (inclui multa de R$ ${fmt(breakdown.lateFee)} e juros de R$ ${fmt(breakdown.interest)})`
      : ''
    msg = `Olá {nome}! Sua mensalidade de ${monthName} venceu em ${dueDate} e está em atraso. Valor devido: R$ ${fmt(breakdown.total)}${extras}. Regularize o pagamento para evitar o bloqueio do transporte.`
  } else {
    const ahead = Math.max(1, -late)
    msg = `Olá {nome}! Sua mensalidade de ${monthName} vence em ${ahead} dia(s), em ${dueDate}. Valor: R$ ${fmt(breakdown.principal)}.`
  }
  return `${msg}${signature ? `\n\n${signature}` : ''}`
}

export async function sendPaymentReminders(db: any = getDb(), settings: AppSettings = loadSettings(db), today: Date = new Date()): Promise<ReminderResult> {
  const auto = settings.communication?.autoMessages === true
  if (!auto) {
    return { remindersSent: 0, autoMessagesDisabled: true }
  }

  const reminderDays = Math.max(1, Number(settings.billing.reminderDaysBefore) || 5)
  const tolerance = Math.max(0, Number(settings.billing.toleranceDays) || 0)

  const pending = db.prepare(`
    SELECT mf.*, p.phone FROM monthly_fees mf
    LEFT JOIN passengers p ON p.id = mf.passenger_id
    WHERE mf.status IN ('pending', 'overdue')
    AND NOT EXISTS (SELECT 1 FROM payments WHERE payments.monthly_fee_id = mf.id)
  `).all() as any[]

  let sent = 0
  for (const fee of pending) {
    try {
      const due = buildDueDate(Number(fee.year), Number(fee.month), Number(fee.due_day))
      const late = daysLate(due, today)
      const isReminderWindow = late <= 0 && -late === reminderDays
      const isOverdue = late > tolerance
      if (!isReminderWindow && !isOverdue) continue

      const message = buildMessage(fee, settings, today)
      const phone = fee.phone || ''

      if (phone) {
        const result = await whatsappService.send(phone, message.replace(/{nome}/g, fee.passenger_name))
        if (result.success) sent++
      }

      addNotification(db, fee.passenger_id, 'Lembrete de pagamento', message.replace(/{nome}/g, fee.passenger_name), '/mensalidades')
      await pushService.send(fee.passenger_id, 'Lembrete de pagamento', message.replace(/{nome}/g, fee.passenger_name))
    } catch (err) {
      logger.warn({ feeId: fee.id, err }, 'Failed to send payment reminder')
    }
  }

  if (sent > 0) logger.info({ sent }, 'Payment reminders sent')
  return { remindersSent: sent, autoMessagesDisabled: false }
}

export function notifyPaymentReceived(db: any = getDb(), fee: any, payment: any): void {
  try {
    const monthName = MONTH_NAMES[Number(fee.month) - 1] || String(fee.month)
    const amount = fmt(Number(payment.amount) || 0)
    const message = `Pagamento de ${monthName} registrado no valor de R$ ${amount}. Obrigado!`
    addNotification(db, fee.passenger_id, 'Pagamento registrado', message, '/mensalidades')
    pushService.send(fee.passenger_id, 'Pagamento registrado', message).catch(() => undefined)

    const adminTitle = `${fee.passenger_name} pagou a mensalidade`
    const adminMessage = `Pagamento de ${monthName} no valor de R$ ${amount} confirmado por ${fee.passenger_name}.`
    for (const adminId of getAdminIds(db)) {
      addNotification(db, adminId, adminTitle, adminMessage, '/mensalidades')
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to notify payment received')
  }
}

export interface DailySummary {
  pending: number
  overdue: number
  total: number
}

export function buildDailySummary(db: any = getDb()): DailySummary {
  const pending = db.prepare("SELECT COUNT(*) AS count FROM monthly_fees WHERE status = 'pending'").get() as any
  const overdue = db.prepare("SELECT COUNT(*) AS count FROM monthly_fees WHERE status = 'overdue'").get() as any
  const pendingCount = Number(pending?.count ?? 0)
  const overdueCount = Number(overdue?.count ?? 0)
  return { pending: pendingCount, overdue: overdueCount, total: pendingCount + overdueCount }
}

export function notifyDailySummaryToAdmins(db: any = getDb(), summary: DailySummary): void {
  const { pending, overdue } = summary
  if (pending + overdue === 0) return
  const message = `Resumo do dia: ${pending} mensalidade(s) pendente(s) e ${overdue} em atraso.`
  for (const adminId of getAdminIds(db)) {
    addNotification(db, adminId, 'Resumo diário de pagamentos', message, '/mensalidades')
  }
}
