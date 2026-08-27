import { v4 as uuid } from 'uuid'
import { notifyPaymentReceived } from './feeAutomation.js'
import { alertIntegrationIssue } from './integrationAlert.js'
import { logger } from '../utils/logger.js'

export type PaymentMethod = 'pix' | 'card'
export type EntryType = 'NORMAL' | 'SUBPAYMENT' | 'OVERPAYMENT'

// ── Helpers ────────────────────────────────────────────────────────────────

export function todayBR(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const br = new Date(now.getTime() - offset * 60000)
  return br.toISOString().split('T')[0].split('-').reverse().join('/')
}

/** Convert a monetary value to integer centavos for safe comparison. */
export function toCentavos(value: number): number {
  return Math.round(value * 100)
}

/**
 * Check whether a received amount is valid for financial processing.
 * Rejects: undefined, null, NaN, Infinity, -Infinity, <= 0, non-finite.
 */
export function isValidAmount(value: unknown): value is number {
  if (typeof value !== 'number') return false
  if (!Number.isFinite(value)) return false
  if (value <= 0) return false
  return true
}

/**
 * Resolve the expected amount for a payment.
 *
 * Priority:
 * 1. pix_charges.amount via chargeId (direct lookup)
 * 2. pix_charges.amount via payment_intent_id (indirect lookup)
 * 3. null — no charge found (caller must decide behavior)
 *
 * Falls back to null (never silently uses fee.amount) to force explicit handling.
 */
export function resolveExpectedAmount(
  db: any,
  paymentId: string,
  chargeId?: string
): { amount: number; source: 'charge' | 'fallback' } | null {
  if (chargeId) {
    const charge = db.prepare('SELECT amount FROM pix_charges WHERE id = ?').get(chargeId) as any
    if (charge) return { amount: Number(charge.amount), source: 'charge' }
  }
  if (paymentId) {
    const charge = db.prepare(
      'SELECT amount FROM pix_charges WHERE payment_intent_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(paymentId) as any
    if (charge) return { amount: Number(charge.amount), source: 'charge' }
  }
  return null
}

// ── Core: finalizePayment ──────────────────────────────────────────────────

/**
 * Finalize a payment: insert into payments, mark fee as paid, update charge.
 *
 * Amount validation:
 *   - expectedAmount comes from pix_charges.amount (immutable reference)
 *   - receivedCents and expectedCents are compared as integers
 *   - invalid amounts (undefined/NaN/<=0) → reject, do not finalize
 *   - received < expected → SUBPAYMENT (fee stays pending)
 *   - received === expected → NORMAL (fee → paid)
 *   - received > expected → NORMAL + OVERPAYMENT (fee → paid)
 *
 * Deduplication uses structured (external_payment_id, entry_type) indexed
 * column instead of LIKE on notes.
 *
 * All financial mutations run inside db.transaction for concurrency safety.
 *
 * Returns true if the fee was actually marked as paid.
 */
export function finalizePayment(
  db: any,
  fee: any,
  paymentId: string,
  amountReceived: number,
  method: PaymentMethod,
  chargeId?: string
): boolean {
  if (!fee) return false

  // ── Pre-transaction: validate amount ────────────────────────────────────
  if (!isValidAmount(amountReceived)) {
    logger.error(
      { feeId: fee.id, paymentId, amountReceived },
      'Pagamento rejeitado: valor recebido inválido'
    )
    alertIntegrationIssue(
      db,
      'Inconsistência Financeira',
      `Pagamento ${method === 'pix' ? 'PIX' : 'Cartão'} com valor inválido (recebido: ${String(amountReceived)}, MP ID: ${paymentId}) ` +
      `para a mensalidade ${fee.passenger_name} (${String(fee.month).padStart(2, '0')}/${fee.year}). ` +
      `Nenhuma ação foi tomada. Verificar manualmente.`
    )
    return false
  }

  // ── Resolve expected amount ─────────────────────────────────────────────
  const resolved = resolveExpectedAmount(db, paymentId, chargeId)

  let expectedAmount: number

  if (resolved) {
    expectedAmount = resolved.amount
  } else {
    // No pix_charge found. Do NOT auto-finalize.
    logger.warn(
      { feeId: fee.id, paymentId, chargeId },
      'Pagamento sem cobrança registrada (pix_charges). Não é possível validar valor.'
    )
    alertIntegrationIssue(
      db,
      'Inconsistência Financeira',
      `Pagamento ${method === 'pix' ? 'PIX' : 'Cartão'} de R$ ${amountReceived.toFixed(2)} recebido (MP ID: ${paymentId}) ` +
      `para a mensalidade ${fee.passenger_name} (${String(fee.month).padStart(2, '0')}/${fee.year}), ` +
      `mas não foi encontrada cobrança associada (pix_charges). ` +
      `Nenhuma ação foi tomada. Registrar manualmente.`
    )
    return false
  }

  const receivedCents = toCentavos(amountReceived)
  const expectedCents = toCentavos(expectedAmount)

  // ── Transaction: all financial mutations ────────────────────────────────
  let finalized = false
  let notificationPayload: { amount: number; isOverpayment: boolean } | null = null

  const runInTransaction = db.transaction(() => {
    // Deduplication: check structured (external_payment_id, entry_type)
    if (paymentId) {
      const existingNormal = db.prepare(
        'SELECT id FROM payments WHERE external_payment_id = ? AND entry_type = ?'
      ).get(paymentId, 'NORMAL') as any
      if (existingNormal) return
    }

    // Re-check fee status inside the write-lock
    const currentFee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fee.id) as any
    if (!currentFee || currentFee.status === 'paid') return

    // ── Amount decision ─────────────────────────────────────────────────
    if (receivedCents < expectedCents) {
      // SUBPAYMENT: money received but insufficient
      db.prepare(`
        INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, external_payment_id, entry_type)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'SUBPAYMENT')
      `).run(
        uuid(), fee.id, amountReceived, todayBR(), method,
        `SUBPAYMENT Mercado Pago ${paymentId}`,
        paymentId
      )

      // Charge is NOT pending anymore — MP confirmed this payment
      if (chargeId) {
        db.prepare("UPDATE pix_charges SET status = 'succeeded_underpaid', updated_at = datetime('now') WHERE id = ?").run(chargeId)
      } else {
        db.prepare("UPDATE pix_charges SET status = 'succeeded_underpaid', updated_at = datetime('now') WHERE payment_intent_id = ?").run(paymentId)
      }

      const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
      alertIntegrationIssue(
        db,
        'Pagamento Incompleto',
        `Pagamento ${methodLabel} de R$ ${amountReceived.toFixed(2)} recebido (MP ID: ${paymentId}) ` +
        `para a mensalidade ${fee.passenger_name} (${String(fee.month).padStart(2, '0')}/${fee.year}) ` +
        `que deveria ser R$ ${expectedAmount.toFixed(2)}. Valor insuficiente. Mensalidade NÃO quitada.`
      )

      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, status)
        VALUES (?, ?, ?, ?, 'warning', 'unread')
      `).run(
        uuid(), fee.passenger_id,
        'Pagamento incompleto',
        `Um pagamento ${methodLabel} de R$ ${amountReceived.toFixed(2)} foi recebido ` +
        `para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}, mas o valor devido é R$ ${expectedAmount.toFixed(2)}. ` +
        `A mensalidade continua pendente.`
      )

      logger.warn({ feeId: fee.id, paymentId, received: amountReceived, expected: expectedAmount }, 'Subpayment registrado')
      return
    }

    if (receivedCents === expectedCents) {
      // EXACT PAYMENT
      db.prepare(`
        INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, external_payment_id, entry_type)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'NORMAL')
      `).run(
        uuid(), fee.id, amountReceived, todayBR(), method,
        `${method.toUpperCase()} Mercado Pago ${paymentId}`,
        paymentId
      )

      db.prepare("UPDATE monthly_fees SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(fee.id)

      if (chargeId) {
        db.prepare("UPDATE pix_charges SET status = 'succeeded', updated_at = datetime('now') WHERE id = ?").run(chargeId)
      } else {
        db.prepare("UPDATE pix_charges SET status = 'succeeded', updated_at = datetime('now') WHERE payment_intent_id = ?").run(paymentId)
      }

      notificationPayload = { amount: amountReceived, isOverpayment: false }
      finalized = true
    } else {
      // OVERPAYMENT: received > expected — NORMAL + OVERPAYMENT in same transaction
      db.prepare(`
        INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, external_payment_id, entry_type)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'NORMAL')
      `).run(
        uuid(), fee.id, expectedAmount, todayBR(), method,
        `${method.toUpperCase()} Mercado Pago ${paymentId}`,
        paymentId
      )

      const excessAmount = (receivedCents - expectedCents) / 100
      db.prepare(`
        INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, external_payment_id, entry_type)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'OVERPAYMENT')
      `).run(
        uuid(), fee.id, excessAmount, todayBR(), method,
        `OVERPAYMENT Mercado Pago ${paymentId}`,
        paymentId
      )

      db.prepare("UPDATE monthly_fees SET status = 'paid', updated_at = datetime('now') WHERE id = ?").run(fee.id)

      if (chargeId) {
        db.prepare("UPDATE pix_charges SET status = 'succeeded_overpaid', updated_at = datetime('now') WHERE id = ?").run(chargeId)
      } else {
        db.prepare("UPDATE pix_charges SET status = 'succeeded_overpaid', updated_at = datetime('now') WHERE payment_intent_id = ?").run(paymentId)
      }

      notificationPayload = { amount: amountReceived, isOverpayment: true }
      finalized = true
    }
  })

  runInTransaction()

  if (!finalized) return false

  // Notifications are outside the transaction to minimise lock duration.
  const updated = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fee.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(fee.id)
  notifyPaymentReceived(db, updated, payment)

  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
  if (notificationPayload?.isOverpayment) {
    const excessAmount = (toCentavos(notificationPayload.amount) - toCentavos(expectedAmount)) / 100
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, status)
      VALUES (?, ?, ?, ?, 'payment', 'unread')
    `).run(
      uuid(), fee.passenger_id,
      `${methodLabel} confirmado com excedente`,
      `Pagamento ${methodLabel} de R$ ${notificationPayload.amount.toFixed(2)} confirmado para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}. ` +
      `Valor esperado: R$ ${expectedAmount.toFixed(2)}. Excedente de R$ ${excessAmount.toFixed(2)} registrado.`
    )
  } else {
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, status)
      VALUES (?, ?, ?, ?, 'payment', 'unread')
    `).run(
      uuid(), fee.passenger_id,
      `${methodLabel} confirmado`,
      `Pagamento ${methodLabel} de R$ ${amountReceived.toFixed(2)} confirmado para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}.`
    )
  }

  logger.info({ feeId: fee.id, paymentId, method }, 'Pagamento confirmado')
  return true
}

// ── recordOverpayment ──────────────────────────────────────────────────────

/**
 * Record an overpayment: a MP payment was approved for a fee that is already
 * paid. The money has been received and MUST NOT be ignored (Regra de Ouro).
 *
 * Uses structured (external_payment_id, entry_type) for deduplication.
 */
export function recordOverpayment(
  db: any,
  fee: any,
  paymentId: string,
  amountReceived: number,
  method: PaymentMethod,
  chargeId?: string
): void {
  if (!fee) return

  // Deduplication via structured columns
  if (paymentId) {
    const existing = db.prepare(
      'SELECT id FROM payments WHERE external_payment_id = ? AND entry_type = ?'
    ).get(paymentId, 'OVERPAYMENT') as any
    if (existing) return
  }

  // Fallback dedup via notes for backward compatibility with pre-migration data
  if (!paymentId) {
    const existingByNotes = db.prepare(
      "SELECT id FROM payments WHERE monthly_fee_id = ? AND notes LIKE ?"
    ).get(fee.id, `%OVERPAYMENT%`) as any
    if (existingByNotes) return
  }

  const amount = amountReceived > 0 ? amountReceived : 0
  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, external_payment_id, entry_type)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 'OVERPAYMENT')
  `).run(payId, fee.id, amount, todayBR(), method, `OVERPAYMENT Mercado Pago ${paymentId}`, paymentId || null)

  // Mark the charge as succeeded_overpaid if applicable
  if (chargeId) {
    db.prepare("UPDATE pix_charges SET status = 'succeeded_overpaid', updated_at = datetime('now') WHERE id = ? AND status NOT IN ('succeeded', 'succeeded_overpaid')").run(chargeId)
  } else if (paymentId) {
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
