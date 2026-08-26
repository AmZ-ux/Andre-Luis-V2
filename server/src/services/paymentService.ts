import { v4 as uuid } from 'uuid'
import { notifyPaymentReceived } from './feeAutomation.js'
import { alertIntegrationIssue } from './integrationAlert.js'
import { logger } from '../utils/logger.js'

export type PaymentMethod = 'pix' | 'card'

export function todayBR(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const br = new Date(now.getTime() - offset * 60000)
  return br.toISOString().split('T')[0].split('-').reverse().join('/')
}

/**
 * Finalize a payment: insert into payments, mark fee as paid, update charge.
 *
 * The core logic runs inside a db.transaction (better-sqlite3 write-lock) to
 * prevent two concurrent confirmations (webhook + polling) from creating
 * duplicate payment rows — the classic TOCTOU race.
 *
 * A deduplication check on the MP paymentId stored in `notes` is performed
 * INSIDE the transaction to guarantee atomicity.
 *
 * Returns true if the payment was actually finalized, false if it was a no-op
 * (duplicate paymentId, fee already paid, etc.).
 */
export function finalizePayment(db: any, fee: any, paymentId: string, amountReceived: number, method: PaymentMethod, chargeId?: string): boolean {
  if (!fee) return false

  let finalized = false
  let amount = 0

  const runInTransaction = db.transaction(() => {
    // Deduplication: has this MP paymentId already been recorded for this fee?
    const existing = db.prepare(
      "SELECT id FROM payments WHERE monthly_fee_id = ? AND notes LIKE ?"
    ).get(fee.id, `%Mercado Pago ${paymentId}%`) as any
    if (existing) return

    // Re-check fee status inside the write-lock
    const currentFee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fee.id) as any
    if (!currentFee || currentFee.status === 'paid') return

    amount = amountReceived > 0 ? amountReceived : Number(fee.amount)
    const payId = uuid()
    db.prepare(`
      INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0)
    `).run(payId, fee.id, amount, todayBR(), method, `${method.toUpperCase()} Mercado Pago ${paymentId}`)

    db.prepare("UPDATE monthly_fees SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(fee.id)

    if (chargeId) {
      db.prepare("UPDATE pix_charges SET status = 'succeeded', updated_at = datetime('now') WHERE id = ?").run(chargeId)
    } else {
      db.prepare("UPDATE pix_charges SET status = 'succeeded', updated_at = datetime('now') WHERE payment_intent_id = ?").run(paymentId)
    }

    finalized = true
  })

  runInTransaction()

  if (!finalized) return false

  // Notifications are outside the transaction to minimise lock duration.
  const updated = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fee.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(fee.id)
  notifyPaymentReceived(db, updated, payment)

  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, 'payment', 'unread')
  `).run(uuid(), fee.passenger_id, `${methodLabel} confirmado`, `Pagamento ${methodLabel} de R$ ${amount.toFixed(2)} confirmado para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}.`)

  logger.info({ feeId: fee.id, paymentId, method }, 'Pagamento confirmado')
  return true
}

/**
 * Record an overpayment: a MP payment was approved for a fee that is already
 * paid. The money has been received and MUST NOT be ignored (Regra de Ouro).
 *
 * The record is persisted in `payments` with an OVERPAYMENT prefix in notes
 * so it is immediately visible in admin views and reconciliation queries.
 *
 * Deduplication: if this paymentId has already been recorded for this fee
 * (normal or overpayment), the call is a no-op.
 */
export function recordOverpayment(db: any, fee: any, paymentId: string, amountReceived: number, method: PaymentMethod, chargeId?: string): void {
  if (!fee) return

  // Deduplication: same MP paymentId already recorded for this fee?
  const existing = db.prepare(
    "SELECT id FROM payments WHERE monthly_fee_id = ? AND notes LIKE ?"
  ).get(fee.id, `%${paymentId}%`) as any
  if (existing) return

  const amount = amountReceived > 0 ? amountReceived : 0
  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(payId, fee.id, amount, todayBR(), method, `OVERPAYMENT Mercado Pago ${paymentId}`)

  // Mark the charge as succeeded_overpaid if applicable
  if (chargeId) {
    db.prepare("UPDATE pix_charges SET status = 'succeeded_overpaid', updated_at = datetime('now') WHERE id = ? AND status NOT IN ('succeeded', 'succeeded_overpaid')").run(chargeId)
  } else {
    db.prepare("UPDATE pix_charges SET status = 'succeeded_overpaid', updated_at = datetime('now') WHERE payment_intent_id = ? AND status NOT IN ('succeeded', 'succeeded_overpaid')").run(paymentId)
  }

  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
  const description = `Pagamento ${methodLabel} de R$ ${amount.toFixed(2)} recebido (MP ID: ${paymentId}) para a mensalidade ${fee.passenger_name} (${String(fee.month).padStart(2, '0')}/${fee.year}) que já estava quitada. Verificar necessidade de estorno.`
  alertIntegrationIssue(db, 'Pagamento Excedente', description)

  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, 'warning', 'unread')
  `).run(uuid(), fee.passenger_id, `Pagamento ${methodLabel} excedente`, `Um pagamento ${methodLabel} de R$ ${amount.toFixed(2)} foi recebido para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}, mas ela já estava quitada. O valor está registrado e será analisado pelo administrador.`)

  logger.warn({ feeId: fee.id, paymentId, amount }, 'Pagamento excedente registrado')
}
