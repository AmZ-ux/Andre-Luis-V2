import { Router } from 'express'
import type { Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import { getStripe, webhookSecret } from '../services/stripeService.js'
import { notifyPaymentReceived } from '../services/feeAutomation.js'
import { logger } from '../utils/logger.js'

export const paymentsRouter = Router()

type PaymentMethod = 'pix' | 'card'

function todayBR(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const br = new Date(now.getTime() - offset * 60000)
  return br.toISOString().split('T')[0].split('-').reverse().join('/')
}

// Tabela pix_charges e usada como registro generico de cobrancas (PIX e cartao)
function finalizePayment(db: any, fee: any, paymentIntentId: string, amountReceived: number, method: PaymentMethod): void {
  if (!fee || fee.status === 'paid') return

  const amount = amountReceived > 0 ? amountReceived : Number(fee.amount)
  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(payId, fee.id, amount, todayBR(), method, `${method.toUpperCase()} Stripe ${paymentIntentId}`)

  db.prepare('UPDATE monthly_fees SET status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?').run(fee.id)
  db.prepare('UPDATE pix_charges SET status = \'succeeded\', updated_at = datetime(\'now\') WHERE payment_intent_id = ?').run(paymentIntentId)

  const updated = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fee.id) as any
  const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(fee.id)
  notifyPaymentReceived(db, updated, payment)

  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, 'payment', 'unread')
  `).run(uuid(), fee.passenger_id, `${methodLabel} confirmado`, `Pagamento ${methodLabel} de R$ ${amount.toFixed(2)} confirmado para a mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year}.`, '')

  logger.info({ feeId: fee.id, paymentIntentId, method }, 'Pagamento confirmado')
}

paymentsRouter.post('/create', async (req, res) => {
  const db = getDb()
  const { monthlyFeeId, method = 'pix' } = req.body || {}
  const payMethod: PaymentMethod = method === 'card' ? 'card' : 'pix'

  if (!monthlyFeeId) {
    res.status(400).json({ error: 'Mensalidade é obrigatória' })
    return
  }

  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(monthlyFeeId) as any
  if (!fee) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }
  if (fee.status === 'paid') { res.status(400).json({ error: 'Pagamento já registrado para esta mensalidade' }); return }
  if (fee.status === 'cancelled') { res.status(400).json({ error: 'Não é possível cobrar uma mensalidade cancelada' }); return }
  if (fee.status === 'exempt') { res.status(400).json({ error: 'Não é possível cobrar uma mensalidade isenta' }); return }

  const settings = loadSettings(db)
  const breakdown = calculateDueFromFee(fee, settings, new Date())
  const amountInCents = Math.round(breakdown.total * 100)

  try {
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountInCents,
      currency: 'brl',
      ...(process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION
        ? {
            automatic_payment_methods: { enabled: true },
            payment_method_configuration: process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION,
          }
        : { payment_method_types: [payMethod] }),
      description: `Mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year} - ${fee.passenger_name}`,
      metadata: {
        monthly_fee_id: monthlyFeeId,
        passenger_id: fee.passenger_id,
        passenger_name: fee.passenger_name,
        payment_method: payMethod,
      },
    })

    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(uuid(), paymentIntent.id, monthlyFeeId, breakdown.total)

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: breakdown.total,
      currency: 'brl',
      breakdown,
      paymentIntentId: paymentIntent.id,
      method: payMethod,
    })
  } catch (err: any) {
    logger.error({ err: err.message }, 'Falha ao criar cobrança no Stripe')
    res.status(502).json({ error: `Falha ao gerar cobrança: ${err.message}` })
  }
})

paymentsRouter.get('/status', async (req, res) => {
  const { monthlyFeeId } = req.query
  if (!monthlyFeeId) { res.status(400).json({ error: 'Mensalidade é obrigatória' }); return }

  const db = getDb()
  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(monthlyFeeId) as any
  if (!fee) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }

  if (fee.status === 'paid') { res.json({ status: 'paid' }); return }

  // Conciliação: consulta o Stripe e marca como pago se a cobrança foi confirmada
  const charge = db.prepare(
    'SELECT * FROM pix_charges WHERE monthly_fee_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(monthlyFeeId) as any

  if (charge) {
    try {
      const pi = await getStripe().paymentIntents.retrieve(charge.payment_intent_id)
      if (pi.status === 'succeeded') {
        finalizePayment(db, fee, pi.id, Number(pi.amount_received) / 100, pi.metadata?.payment_method === 'card' ? 'card' : 'pix')
        res.json({ status: 'paid' })
        return
      }
      if (pi.status === 'canceled') {
        res.json({ status: 'cancelled' })
        return
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Falha ao consultar PaymentIntent no Stripe')
      res.status(502).json({ error: `Falha ao consultar o pagamento: ${err.message}` })
      return
    }
  }

  res.json({ status: fee.status })
})

export function handleStripeWebhook(req: Request, res: Response): void {
  let event: any
  try {
    const signature = req.headers['stripe-signature'] as string
    if (!signature) {
      res.status(400).json({ error: 'Assinatura do webhook ausente' })
      return
    }
    event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret())
  } catch (err: any) {
    logger.error({ err: err.message }, 'Assinatura de webhook Stripe inválida')
    res.status(400).json({ error: `Assinatura inválida: ${err.message}` })
    return
  }

  const db = getDb()
  const paymentIntent = event.data?.object
  const method: PaymentMethod = paymentIntent?.metadata?.payment_method === 'card' ? 'card' : 'pix'
  const methodLabel = method === 'pix' ? 'PIX' : 'Cartão'

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const feeId = paymentIntent?.metadata?.monthly_fee_id
      if (feeId) {
        const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId) as any
        if (fee && fee.status !== 'paid') {
          finalizePayment(db, fee, paymentIntent.id, Number(paymentIntent.amount_received ?? paymentIntent.amount) / 100, method)
        }
      }
      break
    }
    case 'payment_intent.payment_failed': {
      const feeId = paymentIntent?.metadata?.monthly_fee_id
      if (feeId) {
        const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId) as any
        if (fee) {
          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, status)
            VALUES (?, ?, ?, ?, 'warning', 'unread')
          `).run(uuid(), fee.passenger_id, `${methodLabel} não confirmado`, `A cobrança ${methodLabel} gerada não foi paga ou expirou. Gere uma nova cobrança quando desejar.`, '')
        }
      }
      break
    }
    default:
      break
  }

  res.json({ received: true })
}
