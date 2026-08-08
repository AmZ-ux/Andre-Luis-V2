import { v4 as uuid } from 'uuid'
import { notifyPaymentReceived } from './feeAutomation.js'
import { logger } from '../utils/logger.js'

export type PaymentMethod = 'pix' | 'card'

export function todayBR(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const br = new Date(now.getTime() - offset * 60000)
  return br.toISOString().split('T')[0].split('-').reverse().join('/')
}

// pix_charges e usada como registro generico de cobrancas (PIX e cartao)
export function finalizePayment(db: any, fee: any, paymentId: string, amountReceived: number, method: PaymentMethod, chargeId?: string): void {
  if (!fee || fee.status === 'paid') return

  const amount = amountReceived > 0 ? amountReceived : Number(fee.amount)
  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(payId, fee.id, amount, todayBR(), method, `${method.toUpperCase()} Mercado Pago ${paymentId}`)

  db.prepare('UPDATE monthly_fees SET status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?').run(fee.id)
  if (chargeId) {
    db.prepare('UPDATE pix_charges SET status = \'succeeded\', updated_at = datetime(\'now\') WHERE id = ?').run(chargeId)
  } else {
    db.prepare('UPDATE pix_charges SET status = \'succeeded\', updated_at = datetime(\'now\') WHERE payment_intent_id = ?').run(paymentId)
  }

  const updated = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fee.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(fee.id)
  notifyPaymentReceived(db, updated, payment)

  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, 'payment', 'unread')
  `).run(uuid(), fee.passenger_id, `${methodLabel} confirmado`, `Pagamento ${methodLabel} de R$ ${amount.toFixed(2)} confirmado para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}.`)

  logger.info({ feeId: fee.id, paymentId, method }, 'Pagamento confirmado')
}
