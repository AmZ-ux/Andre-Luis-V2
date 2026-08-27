import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { calculateDueFromFee } from '../services/billingRules.js'
import { finalizePayment, recordOverpayment, type PaymentMethod } from '../services/paymentService.js'
import { alertIntegrationIssue } from '../services/integrationAlert.js'
import {
  MpError,
  createCardPaymentLink,
  createPixCharge,
  getPayment,
  mpStatus,
  searchPaymentByExternalReference,
} from '../services/mercadopagoService.js'
import { logger } from '../utils/logger.js'

export const paymentsRouter = Router()
export const paymentsWebhookRouter = Router()

// Webhook do Mercado Pago (público — montado antes do authMiddleware no index.ts).
// Elimina a dependência do polling: notificações de pagamento são processadas
// imediatamente ao chegar. A autenticidade é garantida consultando o próprio MP.
paymentsWebhookRouter.post('/webhook', async (req, res) => {
  const body = req.body || {}
  const paymentId = body?.data?.id ?? body?.payment_id
  const eventType = String(body?.type || body?.action || '')
  if (!paymentId || !eventType.toLowerCase().includes('payment')) {
    res.status(200).json({ received: true, ignored: true })
    return
  }

  try {
    const payment = await getPayment(Number(paymentId))
    const feeId = payment.external_reference
    if (!feeId) {
      res.status(200).json({ received: true, ignored: true })
      return
    }

    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId) as any
    if (!fee) {
      res.status(200).json({ received: true, ignored: true })
      return
    }

    const status = mpStatus(payment.status)
    if (status === 'paid') {
      if (fee.status !== 'paid') {
        // Look up the charge for amount validation
        const charge = db.prepare(
          "SELECT id FROM pix_charges WHERE payment_intent_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
        ).get(String(payment.id)) as any
        finalizePayment(
          db,
          fee,
          String(payment.id),
          Number(payment.transaction_amount ?? 0),
          payment.payment_method_id === 'pix' ? 'pix' : 'card',
          charge?.id
        )
        logger.info({ paymentId: payment.id, feeId }, 'Pagamento finalizado via webhook')
      } else {
        // Regra de Ouro: fee already paid but MP says this payment is approved.
        // Record the overpayment — money received must never be invisible.
        const charge = db.prepare(
          "SELECT id FROM pix_charges WHERE payment_intent_id = ? ORDER BY created_at DESC LIMIT 1"
        ).get(String(payment.id)) as any
        recordOverpayment(
          db,
          fee,
          String(payment.id),
          Number(payment.transaction_amount ?? 0),
          payment.payment_method_id === 'pix' ? 'pix' : 'card',
          charge?.id
        )
        logger.info({ paymentId: payment.id, feeId }, 'Pagamento excedente detectado via webhook')
      }
    } else if (status === 'cancelled') {
      db.prepare("UPDATE pix_charges SET status = 'cancelled', updated_at = datetime('now') WHERE monthly_fee_id = ? AND status = 'pending'").run(feeId)
    }

    res.status(200).json({ received: true })
  } catch (err: any) {
    logger.error({ err: err.message, paymentId }, 'Webhook do Mercado Pago falhou')
    alertIntegrationIssue(getDb(), 'Mercado Pago', `Falha ao processar webhook do pagamento ${paymentId}: ${err.message}`)
    // Sempre 200 para o MP não ficar refazendo retentativas em envios inválidos
    res.status(200).json({ received: true, ignored: true })
  }
})

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
      const expiryHours = Number(process.env.MP_PIX_EXPIRY_HOURS) || 24

      // ── Charge reuse / supersede logic ──────────────────────────────────
      // Only one pending charge per fee is allowed (enforced by unique partial
      // index idx_one_pending_per_fee). If one exists:
      //   • valid + has QR data  → return cached QR (no MP call)
      //   • expired / no QR      → supersede it, then create a new one below
      const existingPending = db.prepare(
        "SELECT id, payment_intent_id, pix_code, qr_image, amount FROM pix_charges WHERE monthly_fee_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
      ).get(monthlyFeeId) as any

      if (existingPending) {
        const isExpired = db.prepare(
          "SELECT 1 FROM pix_charges WHERE id = ? AND created_at <= datetime('now', ?)"
        ).get(existingPending.id, `-${expiryHours} hours`)

        if (isExpired || !existingPending.pix_code || !existingPending.qr_image) {
          // Supersede: keep the charge trackable but mark it as no longer payable
          db.prepare(
            "UPDATE pix_charges SET status = 'superseded', superseded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
          ).run(existingPending.id)
          // Fall through to create a new charge
        } else {
          // Valid pending charge with QR data — return cached response
          res.json({
            paymentId: existingPending.payment_intent_id,
            amount: existingPending.amount,
            currency: 'brl',
            breakdown,
            method: 'pix',
            pixCode: existingPending.pix_code,
            qrImage: existingPending.qr_image,
          })
          return
        }
      }

      // ── Deterministic idempotency key ───────────────────────────────────
      // Key = pix:{feeId}:{YYYY-MM}:v{attemptNumber}
      // attemptNumber = total charges ever created for this fee + 1
      // This lets retries of the SAME request use the same key (safe: no
      // supersede happened yet) while allowing NEW charges after supersede
      // (key changes because count incremented).
      const attemptCount = db.prepare(
        "SELECT COUNT(*) as cnt FROM pix_charges WHERE monthly_fee_id = ?"
      ).get(monthlyFeeId) as any
      const attemptNumber = (attemptCount?.cnt || 0) + 1
      const monthKey = `${fee.year}-${String(fee.month).padStart(2, '0')}`
      const idempotencyKey = `pix:${monthlyFeeId}:${monthKey}:v${attemptNumber}`

      const payment = await createPixCharge({
        amount: breakdown.total,
        description,
        monthlyFeeId,
        payerEmail: passenger?.email || '',
        payerCpf: cpfDigits.length === 11 ? cpfDigits : undefined,
        idempotencyKey,
      })

      const txn = payment.point_of_interaction?.transaction_data
      if (!txn?.qr_code || !txn.qr_code_base64) {
        throw new MpError('O Mercado Pago não retornou o QR Code do PIX. Tente novamente.')
      }

      db.prepare(`
        INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, pix_code, qr_image)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `).run(uuid(), String(payment.id), monthlyFeeId, breakdown.total, txn.qr_code, `data:image/png;base64,${txn.qr_code_base64}`)

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
        // Look up the charge for amount validation
        const charge = db.prepare(
          "SELECT id FROM pix_charges WHERE payment_intent_id = ? ORDER BY created_at DESC LIMIT 1"
        ).get(String(payment.id)) as any
        finalizePayment(db, fee, String(payment.id), Number(payment.transaction_amount ?? 0), method, charge?.id)
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
