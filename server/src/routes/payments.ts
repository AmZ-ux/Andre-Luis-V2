import { Router } from 'express'
import type { Request, Response } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import {
  AsaasError,
  createCharge,
  findOrCreateCustomer,
  getPayment,
  getPixQrCode,
  toAsaasStatus,
} from '../services/asaasService.js'
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

function asaasDueDate(fee: any): string {
  const parts = String(fee.due_date).split('/')
  if (parts.length === 3) {
    const day = String(parts[0]).padStart(2, '0')
    const month = String(parts[1]).padStart(2, '0')
    if (!Number.isNaN(Number(day)) && !Number.isNaN(Number(month))) return `${parts[2]}-${month}-${day}`
  }
  const fallback = new Date(fee.year, fee.month - 1, fee.due_day)
  const br = new Date(fallback.getTime() - fallback.getTimezoneOffset() * 60000)
  return br.toISOString().split('T')[0]
}

// Tabela pix_charges e usada como registro generico de cobrancas (PIX e cartao)
function finalizePayment(db: any, fee: any, paymentId: string, amountReceived: number, method: PaymentMethod): void {
  if (!fee || fee.status === 'paid') return

  const amount = amountReceived > 0 ? amountReceived : Number(fee.amount)
  const payId = uuid()
  db.prepare(`
    INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
  `).run(payId, fee.id, amount, todayBR(), method, `${method.toUpperCase()} Asaas ${paymentId}`)

  db.prepare('UPDATE monthly_fees SET status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?').run(fee.id)
  db.prepare('UPDATE pix_charges SET status = \'succeeded\', updated_at = datetime(\'now\') WHERE payment_intent_id = ?').run(paymentId)

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

function notifyPaymentFailed(fee: any, methodLabel: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, 'warning', 'unread')
  `).run(uuid(), fee.passenger_id, `${methodLabel} não confirmado`, `A cobrança ${methodLabel} gerada não foi paga ou expirou. Gere uma nova cobrança quando desejar.`)
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
  if (req.user?.role !== 'admin' && fee.passenger_id !== req.user?.userId) {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }
  if (fee.status === 'paid') { res.status(400).json({ error: 'Pagamento já registrado para esta mensalidade' }); return }
  if (fee.status === 'cancelled') { res.status(400).json({ error: 'Não é possível cobrar uma mensalidade cancelada' }); return }
  if (fee.status === 'exempt') { res.status(400).json({ error: 'Não é possível cobrar uma mensalidade isenta' }); return }

  const settings = loadSettings(db)
  const breakdown = calculateDueFromFee(fee, settings, new Date())
  const passenger = db.prepare('SELECT * FROM passengers WHERE id = ?').get(fee.passenger_id) as any

  try {
    const customer = await findOrCreateCustomer({
      name: fee.passenger_name || passenger?.name || 'Passageiro',
      cpf: fee.cpf || passenger?.cpf || '',
      email: passenger?.email || '',
      phone: passenger?.phone || passenger?.whatsapp || '',
    })

    const billingType = payMethod === 'pix' ? 'PIX' : 'CREDIT_CARD'
    const charge = await createCharge({
      customerId: customer.id,
      billingType,
      value: breakdown.total,
      dueDate: asaasDueDate(fee),
      description: `Mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year} - ${fee.passenger_name}`,
      monthlyFeeId,
    })

    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(uuid(), charge.id, monthlyFeeId, breakdown.total)

    const base = {
      paymentId: charge.id,
      amount: breakdown.total,
      currency: 'brl',
      breakdown,
      method: payMethod,
    }

    if (payMethod === 'pix') {
      const qr = await getPixQrCode(charge.id)
      res.json({
        ...base,
        pixCode: qr.payload,
        qrImage: qr.encodedImage.startsWith('data:') ? qr.encodedImage : `data:image/png;base64,${qr.encodedImage}`,
        expirationDate: qr.expirationDate,
      })
      return
    }

    res.json({
      ...base,
      paymentUrl: charge.paymentUrl || charge.invoiceUrl || '',
    })
  } catch (err: any) {
    if (err instanceof AsaasError) {
      logger.error({ err: err.message }, 'Falha ao gerar cobrança no Asaas')
      res.status(err.status).json({ error: err.message })
      return
    }
    logger.error({ err: err.message }, 'Falha ao gerar cobrança no Asaas')
    res.status(502).json({ error: `Falha ao gerar cobrança: ${err.message}` })
  }
})

paymentsRouter.get('/status', async (req, res) => {
  const { monthlyFeeId } = req.query
  if (!monthlyFeeId) { res.status(400).json({ error: 'Mensalidade é obrigatória' }); return }

  const db = getDb()
  const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(monthlyFeeId) as any
  if (!fee) { res.status(404).json({ error: 'Mensalidade não encontrada' }); return }
  if (req.user?.role !== 'admin' && fee.passenger_id !== req.user?.userId) {
    res.status(403).json({ error: 'Acesso negado' })
    return
  }

  if (fee.status === 'paid') { res.json({ status: 'paid' }); return }

  // Conciliação: consulta o Asaas e marca como pago se a cobrança foi confirmada
  const charge = db.prepare(
    'SELECT * FROM pix_charges WHERE monthly_fee_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(monthlyFeeId) as any

  if (charge) {
    try {
      const asaasCharge = await getPayment(charge.payment_intent_id)
      const status = toAsaasStatus(asaasCharge.status)
      if (status === 'paid') {
        const method: PaymentMethod = asaasCharge.billingType === 'CREDIT_CARD' ? 'card' : 'pix'
        finalizePayment(db, fee, asaasCharge.id, Number(asaasCharge.value ?? asaasCharge.netValue ?? 0), method)
        res.json({ status: 'paid' })
        return
      }
      if (status === 'cancelled') {
        res.json({ status: 'cancelled' })
        return
      }
    } catch (err: any) {
      if (err instanceof AsaasError && err.status === 404) {
        res.json({ status: fee.status })
        return
      }
      logger.error({ err: err.message }, 'Falha ao consultar cobrança no Asaas')
      res.status(502).json({ error: `Falha ao consultar o pagamento: ${err.message}` })
      return
    }
  }

  res.json({ status: fee.status })
})

export function handleAsaasWebhook(req: Request, res: Response): void {
  const event = req.body?.event
  const payment = req.body?.payment
  const db = getDb()

  if (!event || !payment?.id) {
    res.status(400).json({ error: 'Evento inválido' })
    return
  }

  const feeId = payment.externalReference
  const fee = feeId
    ? db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId) as any
    : db.prepare(`
        SELECT mf.* FROM monthly_fees mf
        JOIN pix_charges pc ON pc.monthly_fee_id = mf.id
        WHERE pc.payment_intent_id = ? LIMIT 1
      `).get(payment.id) as any

  if (fee) {
    const method: PaymentMethod = payment.billingType === 'CREDIT_CARD' ? 'card' : 'pix'
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      finalizePayment(db, fee, payment.id, Number(payment.value ?? payment.netValue ?? 0), method)
    } else if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_REMOVED' || event === 'PAYMENT_CANCELLED' || event === 'PAYMENT_DELETED') {
      notifyPaymentFailed(fee, method === 'pix' ? 'PIX' : 'Cartão')
    }
  }

  res.json({ received: true })
}
