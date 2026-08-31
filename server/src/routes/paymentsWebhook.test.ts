import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import express from 'express'
import request from 'supertest'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb, getDb } from '../database/connection.js'

process.env.DATABASE_PATH = ':memory:'
delete process.env.MERCADO_PAGO_ACCESS_TOKEN

vi.mock('../services/mercadopagoService.js', () => ({
  MpError: class MpError extends Error { constructor(message: string, public status = 502) { super(message) } },
  createPixCharge: vi.fn(),
  createCardPaymentLink: vi.fn(),
  searchPaymentByExternalReference: vi.fn(),
  getPayment: vi.fn(),
  mpStatus: (status: string) => {
    if (status === 'approved') return 'paid'
    if (status === 'rejected' || status === 'cancelled') return 'cancelled'
    return 'pending'
  },
}))

const { getPayment } = await import('../services/mercadopagoService.js')
import { paymentsWebhookRouter } from '../routes/payments.js'

const WEBHOOK_SECRET = 'test-webhook-secret-for-payments'

function buildSignatureHeader(dataId: string | undefined, xRequestId: string, ts: string): string {
  let manifest = ''
  if (dataId) manifest += `id:${dataId.toLowerCase()};`
  manifest += `request-id:${xRequestId};ts:${ts};`
  const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

const app = express()
app.use(express.json())
app.use(sanitizeBody)
app.use('/api/payments', paymentsWebhookRouter)

let passCounter = 0

function seedFee(status = 'pending'): string {
  const db = getDb()
  const pid = uuid()
  passCounter++
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
    .run(pid, 'Webhook Passenger', `333.333.333-${String(passCounter).padStart(2, '0')}`, '2000-01-01')
  const fid = uuid()
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.90, 5, '08/2026', ?)
  `).run(fid, pid, 'Webhook Passenger', '333.333.333-11', status)
  return fid
}

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  vi.mocked(getPayment).mockReset()
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = WEBHOOK_SECRET
})

function signedPost(body: Record<string, any>, query: Record<string, string> = {}) {
  const dataId = query['data.id'] ? String(query['data.id']) : undefined
  const xRequestId = uuid()
  const ts = String(Date.now())
  const signature = buildSignatureHeader(dataId, xRequestId, ts)
  let url = '/api/payments/webhook'
  const qs = new URLSearchParams(query).toString()
  if (qs) url += `?${qs}`
  return request(app)
    .post(url)
    .set('x-signature', signature)
    .set('x-request-id', xRequestId)
    .send(body)
}

describe('POST /api/payments/webhook — signature validation', () => {
  it('should reject when MERCADO_PAGO_WEBHOOK_SECRET is not configured (fail closed)', async () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET
    const res = await request(app).post('/api/payments/webhook').send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when x-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-request-id', uuid())
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when x-request-id header is missing', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', 'ts=123,v1=abc')
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject with invalid signature', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', 'ts=123,v1=0000000000000000000000000000000000000000000000000000000000000000')
      .set('x-request-id', uuid())
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when timestamp is altered', async () => {
    const xRequestId = uuid()
    const ts = '1704908010'
    const manifest = `id:123;request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const tampered = `ts=9999999999,v1=${v1}`
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', tampered)
      .set('x-request-id', xRequestId)
      .query({ 'data.id': '123' })
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when hash is altered', async () => {
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `id:123;request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const tampered = v1.slice(0, -2) + 'ff'
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', `ts=${ts},v1=${tampered}`)
      .set('x-request-id', xRequestId)
      .query({ 'data.id': '123' })
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when data.id is incorrect', async () => {
    // Sign with data.id=123 but send data.id=999
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `id:123;request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .query({ 'data.id': '999' })
      .send({ type: 'payment', data: { id: 999 } })
    expect(res.status).toBe(401)
    expect(getPayment).not.toHaveBeenCalled()
  })
})

describe('POST /api/payments/webhook (assinatura válida)', () => {
  it('should reject when data.id is missing from query string', async () => {
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .send({ type: 'payment', data: { id: 123 } })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('data.id')
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when data.id is absent even if body.data.id is present', async () => {
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .send({ type: 'payment', data: { id: 999 } })
    expect(res.status).toBe(400)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should reject when data.id is absent even if body.payment_id is present', async () => {
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex')
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .send({ type: 'payment', payment_id: 999 })
    expect(res.status).toBe(400)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should ignore non-payment events', async () => {
    const res = await signedPost({ type: 'test', data: { id: 123 } }, { 'data.id': '123' })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should finalize the fee when the payment is approved', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '555', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 555,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res = await signedPost({ type: 'payment', data: { id: 555 } }, { 'data.id': '555' })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(getPayment).toHaveBeenCalledWith(555)

    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee.status).toBe('paid')
    const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(fid) as any
    expect(payment).toBeTruthy()
    expect(payment.payment_method).toBe('pix')
  })

  it('should record overpayment when the fee is already paid (Regra de Ouro)', async () => {
    const db = getDb()
    const fid = seedFee('paid')
    vi.mocked(getPayment).mockResolvedValue({
      id: 556,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res = await signedPost({ type: 'payment', data: { id: 556 } }, { 'data.id': '556' })
    expect(res.status).toBe(200)
    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(payments.length).toBe(1)
    expect(payments[0].amount).toBe(189.9)
  })

  it('should cancel pending charges when the payment is cancelled', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-777', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 777,
      status: 'cancelled',
      status_detail: 'cancelled',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res = await signedPost({ action: 'payment.updated', data: { id: 777 } }, { 'data.id': '777' })
    expect(res.status).toBe(200)
    const charge = db.prepare('SELECT status FROM pix_charges WHERE monthly_fee_id = ?').get(fid) as any
    expect(charge.status).toBe('cancelled')
  })

  it('should ignore payments without external reference', async () => {
    vi.mocked(getPayment).mockResolvedValue({
      id: 888,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 10,
      payment_method_id: 'pix',
    } as any)
    const res = await signedPost({ type: 'payment', data: { id: 888 } }, { 'data.id': '888' })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
  })

  it('should respond 200 and alert when MP consult fails', async () => {
    const db = getDb()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
      .run(uuid(), 'Admin', 'admin@test.com', '000.000.000-00', '', 'hash')
    vi.mocked(getPayment).mockRejectedValue(new Error('API indisponível'))
    const res = await signedPost({ type: 'payment', data: { id: 999 } }, { 'data.id': '999' })
    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe(true)
    const logs = db.prepare("SELECT * FROM app_logs WHERE action = 'integration_error'").all()
    expect(logs.length).toBeGreaterThan(0)
    const notifications = db.prepare("SELECT * FROM notifications WHERE type = 'warning'").all()
    expect(notifications.length).toBe(1)
  })

  it('should not record duplicate overpayment for the same paymentId', async () => {
    const db = getDb()
    const fid = seedFee('paid')
    vi.mocked(getPayment).mockResolvedValue({
      id: 7777,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    await signedPost({ type: 'payment', data: { id: 7777 } }, { 'data.id': '7777' })
    await signedPost({ type: 'payment', data: { id: 7777 } }, { 'data.id': '7777' })

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(payments.length).toBe(1)
  })

  it('should finalize normal payment first, then record overpayment for second approved payment', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '1001', ?, 189.90, 'pending')")
      .run(uuid(), fid)

    vi.mocked(getPayment).mockResolvedValueOnce({
      id: 1001,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)
    await signedPost({ type: 'payment', data: { id: 1001 } }, { 'data.id': '1001' })

    const fee1 = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee1.status).toBe('paid')
    const normalPayments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes NOT LIKE '%OVERPAYMENT%'").all(fid)
    expect(normalPayments.length).toBe(1)

    vi.mocked(getPayment).mockResolvedValueOnce({
      id: 1002,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)
    await signedPost({ type: 'payment', data: { id: 1002 } }, { 'data.id': '1002' })

    const overPayments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(overPayments.length).toBe(1)
    expect(overPayments[0].amount).toBe(189.9)

    const fee2 = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee2.status).toBe('paid')

    const allPayments = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').all(fid)
    expect(allPayments.length).toBe(2)
  })

  it('should mark superseded charge as succeeded_overpaid when webhook arrives late', async () => {
    const db = getDb()
    const fid = seedFee('paid')
    const chargeId = uuid()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '8888', ?, 189.90, 'superseded')").run(chargeId, fid)

    vi.mocked(getPayment).mockResolvedValue({
      id: 8888,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    await signedPost({ type: 'payment', data: { id: 8888 } }, { 'data.id': '8888' })

    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('succeeded_overpaid')
  })

  it('should continue idempotent on duplicate signed webhooks', async () => {
    const db = getDb()
    const fid = seedFee('paid')
    vi.mocked(getPayment).mockResolvedValue({
      id: 7777,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res1 = await signedPost({ type: 'payment', data: { id: 7777 } }, { 'data.id': '7777' })
    const res2 = await signedPost({ type: 'payment', data: { id: 7777 } }, { 'data.id': '7777' })
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(payments.length).toBe(1)
  })
})

describe('POST /api/payments/webhook — payment ID linkage security', () => {
  it('should use query data.id for getPayment, ignoring divergent body.data.id', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '123', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 123,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    await signedPost({ type: 'payment', data: { id: 999 } }, { 'data.id': '123' })

    expect(getPayment).toHaveBeenCalledTimes(1)
    expect(getPayment).toHaveBeenCalledWith(123)
  })

  it('should use query data.id for getPayment, ignoring divergent body.payment_id', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '123', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 123,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    await signedPost({ type: 'payment', payment_id: 999 }, { 'data.id': '123' })

    expect(getPayment).toHaveBeenCalledTimes(1)
    expect(getPayment).toHaveBeenCalledWith(123)
  })

  it('should never call getPayment when signature is invalid', async () => {
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `id:123;request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', 'wrong-secret').update(manifest).digest('hex')

    await request(app)
      .post('/api/payments/webhook?data.id=123')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .send({ type: 'payment', data: { id: 123 } })

    expect(getPayment).not.toHaveBeenCalled()
  })

  it('should never call finalizePayment when signature is invalid', async () => {
    const db = getDb()
    const fid = seedFee()
    const xRequestId = uuid()
    const ts = String(Date.now())
    const manifest = `id:123;request-id:${xRequestId};ts:${ts};`
    const v1 = crypto.createHmac('sha256', 'wrong-secret').update(manifest).digest('hex')

    await request(app)
      .post('/api/payments/webhook?data.id=123')
      .set('x-signature', `ts=${ts},v1=${v1}`)
      .set('x-request-id', xRequestId)
      .send({ type: 'payment', data: { id: 123 } })

    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee.status).toBe('pending')
  })

  it('should finalize via query id when query id matches body data.id', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '789', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 789,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res = await signedPost({ type: 'payment', data: { id: 789 } }, { 'data.id': '789' })
    expect(res.status).toBe(200)
    expect(getPayment).toHaveBeenCalledWith(789)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee.status).toBe('paid')
  })

  it('should process correctly when body has no data.id and no payment_id', async () => {
    const db = getDb()
    const fid = seedFee()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, '456', ?, 189.90, 'pending')")
      .run(uuid(), fid)
    vi.mocked(getPayment).mockResolvedValue({
      id: 456,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    const res = await signedPost({ type: 'payment' }, { 'data.id': '456' })
    expect(res.status).toBe(200)
    expect(getPayment).toHaveBeenCalledWith(456)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee.status).toBe('paid')
  })

  it('should maintain HMAC + getPayment defense-in-depth chain', async () => {
    const fid = seedFee()
    vi.mocked(getPayment).mockResolvedValue({
      id: 654,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
      external_reference: fid,
    } as any)

    await signedPost({ type: 'payment', data: { id: 654 } }, { 'data.id': '654' })

    expect(getPayment).toHaveBeenCalledTimes(1)
    expect(getPayment).toHaveBeenCalledWith(654)
  })
})
