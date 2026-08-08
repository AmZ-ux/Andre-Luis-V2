import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import { finalizePayment, type PaymentMethod } from '../services/paymentService.js'
import { alertIntegrationIssue } from '../services/integrationAlert.js'
import {
  MpError,
  createCardPaymentLink,
  createPixCharge,
  mpStatus,
  searchPaymentByExternalReference,
} from '../services/mercadopagoService.js'
import { logger } from '../utils/logger.js'

export const paymentsRouter = Router()

// Tabela pix_charges e usada como registro generico de cobrancas (PIX e cartao)

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
  const cpfDigits = String(fee.cpf || passenger?.cpf || '').replace(/\D/g, '')
  const description = `Mensalidade ${String(fee.month).padStart(2, '0')}/${fee.year} - ${fee.passenger_name}`

  try {
    if (payMethod === 'pix') {
      const payment = await createPixCharge({
        amount: breakdown.total,
        description,
        monthlyFeeId,
        payerEmail: passenger?.email || '',
        payerCpf: cpfDigits.length === 11 ? cpfDigits : undefined,
      })

      db.prepare(`
        INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(uuid(), String(payment.id), monthlyFeeId, breakdown.total)

      const txn = payment.point_of_interaction?.transaction_data
      if (!txn?.qr_code || !txn.qr_code_base64) {
        throw new MpError('O Mercado Pago não retornou o QR Code do PIX. Tente novamente.')
      }

      res.json({
        paymentId: String(payment.id),
        amount: breakdown.total,
        currency: 'brl',
        breakdown,
        method: 'pix',
        pixCode: txn.qr_code,
        qrImage: `data:image/png;base64,${txn.qr_code_base64}`,
      })
      return
    }

    const preference = await createCardPaymentLink({
      amount: breakdown.total,
      description,
      monthlyFeeId,
      payerEmail: passenger?.email || '',
      payerName: fee.passenger_name || passenger?.name || 'Passageiro',
    })

    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(uuid(), preference.id, monthlyFeeId, breakdown.total)

    res.json({
      paymentId: preference.id,
      amount: breakdown.total,
      currency: 'brl',
      breakdown,
      method: 'card',
      paymentUrl: preference.init_point,
    })
  } catch (err: any) {
    const db = getDb()
    if (err instanceof MpError) {
      logger.error({ err: err.message }, 'Falha ao gerar cobrança no Mercado Pago')
      alertIntegrationIssue(db, 'Mercado Pago', `Falha ao gerar cobrança: ${err.message}`)
      res.status(err.status).json({ error: err.message })
      return
    }
    logger.error({ err: err.message }, 'Falha ao gerar cobrança no Mercado Pago')
    alertIntegrationIssue(db, 'Mercado Pago', `Falha ao gerar cobrança: ${err.message}`)
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

  const expiryHours = Number(process.env.MP_PIX_EXPIRY_HOURS) || 24
  const activeCharge = db.prepare("SELECT id FROM pix_charges WHERE monthly_fee_id = ? AND status = 'pending' AND created_at <= datetime('now', ?)").get(monthlyFeeId, `-${expiryHours} hours`)
  if (activeCharge) {
    db.prepare("UPDATE pix_charges SET status = 'expired', updated_at = datetime('now') WHERE id = ?").run(activeCharge.id)
    res.json({ status: 'expired' })
    return
  }

  // Conciliação: consulta o Mercado Pago pelo external_reference (id da mensalidade)
  try {
    const payment = await searchPaymentByExternalReference(String(monthlyFeeId))
    if (payment) {
      const status = mpStatus(payment.status)
      if (status === 'paid') {
        const method: PaymentMethod = payment.payment_method_id === 'pix' ? 'pix' : 'card'
        finalizePayment(db, fee, String(payment.id), Number(payment.transaction_amount ?? 0), method)
        res.json({ status: 'paid' })
        return
      }
      if (status === 'cancelled') {
        res.json({ status: 'cancelled' })
        return
      }
    }
  } catch (err: any) {
    if (err instanceof MpError) {
      logger.error({ err: err.message }, 'Falha ao consultar pagamento no Mercado Pago')
      alertIntegrationIssue(db, 'Mercado Pago', `Falha ao consultar pagamento: ${err.message}`)
      res.status(err.status).json({ error: `Falha ao consultar o pagamento: ${err.message}` })
      return
    }
  }

  res.json({ status: fee.status })
})
