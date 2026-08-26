import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb, getDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'
import { paymentsRouter } from '../routes/payments.js'
import { finalizePayment, recordOverpayment } from '../services/paymentService.js'

process.env.DATABASE_PATH = ':memory:'
delete process.env.MERCADO_PAGO_ACCESS_TOKEN

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/payments', authMiddleware, paymentsRouter)

let token: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  const adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', '', bcrypt.hashSync('password', 10))
  token = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')
})

let passCounter = 0

function seedPassenger(): string {
  const db = getDb()
  const id = uuid()
  passCounter++
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day, email) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5, ?)")
    .run(id, 'Test Passenger', `111.111.111-${String(passCounter).padStart(2, '0')}`, '2000-01-01', 'pass@test.com')
  return id
}

function seedMonthlyFee(passengerId: string, overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  const month = overrides.month ?? 8
  const year = overrides.year ?? 2026
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, passengerId,
    overrides.passengerName ?? 'Test Passenger',
    overrides.cpf ?? '111.111.111-11',
    'university',
    month, year,
    overrides.amount ?? 189.90,
    overrides.dueDay ?? 5,
    `${String(month).padStart(2, '0')}/${year}`,
    overrides.status ?? 'pending'
  )
  return id
}

describe('POST /api/payments/create (sem MERCADO_PAGO_ACCESS_TOKEN)', () => {
  it('should require monthlyFeeId', async () => {
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Mensalidade é obrigatória')
  })

  it('should reject unknown fee', async () => {
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: 'inexistente' })
    expect(res.status).toBe(404)
  })

  it('should reject paid fees', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('já registrado')
  })

  it('should fail with clear message when Mercado Pago token is missing', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'pix' })
    expect(res.status).toBe(502)
    expect(res.body.error).toContain('MERCADO_PAGO_ACCESS_TOKEN')
  })

  it('should fail with clear message for card too', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'card' })
    expect(res.status).toBe(502)
    expect(res.body.error).toContain('MERCADO_PAGO_ACCESS_TOKEN')
  })
})

describe('GET /api/payments/status', () => {
  it('should require monthlyFeeId', async () => {
    const res = await request(app).get('/api/payments/status').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('should return fee status when no charge exists (no API call)', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app).get('/api/payments/status').set('Authorization', `Bearer ${token}`).query({ monthlyFeeId: fid })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')
  })

  it('should return paid when fee is already paid', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const res = await request(app).get('/api/payments/status').set('Authorization', `Bearer ${token}`).query({ monthlyFeeId: fid })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('paid')
  })

  it('should return expired when pending charge is older than PIX expiry', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, created_at)
      VALUES (?, 'mp-1', ?, 189.90, 'pending', datetime('now', '-25 hours'))
    `).run(uuid(), fid)
    const res = await request(app).get('/api/payments/status').set('Authorization', `Bearer ${token}`).query({ monthlyFeeId: fid })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('expired')
    const charge = db.prepare('SELECT status FROM pix_charges WHERE monthly_fee_id = ?').get(fid) as any
    expect(charge.status).toBe('expired')
  })

  it('should not expire recent pending charges', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, created_at)
      VALUES (?, 'mp-2', ?, 189.90, 'pending', datetime('now', '-2 hours'))
    `).run(uuid(), fid)
    const res = await request(app).get('/api/payments/status').set('Authorization', `Bearer ${token}`).query({ monthlyFeeId: fid })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')
  })
})

// ── P1: charge reuse, supersede, unique index, transactional finalize ────────

describe('POST /api/payments/create — PIX charge reuse (cached QR)', () => {
  it('should return cached QR when a valid pending charge exists', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    const chargeId = uuid()
    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, pix_code, qr_image)
      VALUES (?, 'mp-cached-1', ?, 189.90, 'pending', '00020126580014br.gov.bcb...', 'data:image/png;base64,iVBOR...')
    `).run(chargeId, fid)

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'pix' })
    expect(res.status).toBe(200)
    expect(res.body.pixCode).toBe('00020126580014br.gov.bcb...')
    expect(res.body.qrImage).toContain('data:image/png;base64')
    expect(res.body.paymentId).toBe('mp-cached-1')

    // No additional charge should have been created
    const charges = db.prepare('SELECT * FROM pix_charges WHERE monthly_fee_id = ?').all(fid)
    expect(charges.length).toBe(1)
  })

  it('should supersede expired pending and attempt to create new (no MP token → 502)', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, created_at)
      VALUES (?, 'mp-expired', ?, 189.90, 'pending', datetime('now', '-25 hours'))
    `).run(uuid(), fid)

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'pix' })
    // Falls through to MP call which fails (no token)
    expect(res.status).toBe(502)
    // Old charge should be superseded
    const oldCharge = db.prepare("SELECT status FROM pix_charges WHERE payment_intent_id = 'mp-expired'").get() as any
    expect(oldCharge.status).toBe('superseded')
  })

  it('should supersede pending without QR data (legacy charge)', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    db.prepare(`
      INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, pix_code, qr_image, created_at)
      VALUES (?, 'mp-legacy', ?, 189.90, 'pending', '', '', datetime('now', '-2 hours'))
    `).run(uuid(), fid)

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'pix' })
    expect(res.status).toBe(502) // Falls through to MP (no token)
    const oldCharge = db.prepare("SELECT status FROM pix_charges WHERE payment_intent_id = 'mp-legacy'").get() as any
    expect(oldCharge.status).toBe('superseded')
  })
})

describe('pix_charges unique partial index (engine-level enforcement)', () => {
  it('should prevent inserting a second pending charge for the same fee', () => {
    const db = getDb()
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-a', ?, 189.90, 'pending')").run(uuid(), fid)
    expect(() => {
      db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-b', ?, 189.90, 'pending')").run(uuid(), fid)
    }).toThrow()
  })

  it('should allow pending charges for different fees', () => {
    const db = getDb()
    const pid = seedPassenger()
    const fid1 = seedMonthlyFee(pid, { month: 7 })
    const fid2 = seedMonthlyFee(pid, { month: 8 })
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-x', ?, 189.90, 'pending')").run(uuid(), fid1)
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-y', ?, 189.90, 'pending')").run(uuid(), fid2)
    const count = db.prepare("SELECT COUNT(*) as cnt FROM pix_charges WHERE status = 'pending'").get() as any
    expect(count.cnt).toBe(2)
  })

  it('should allow non-pending charges for the same fee', () => {
    const db = getDb()
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-c', ?, 189.90, 'pending')").run(uuid(), fid)
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-d', ?, 189.90, 'succeeded')").run(uuid(), fid)
    const count = db.prepare('SELECT COUNT(*) as cnt FROM pix_charges WHERE monthly_fee_id = ?').get(fid) as any
    expect(count.cnt).toBe(2)
  })
})

describe('finalizePayment — transactional + deduplication', () => {
  it('should finalize only once when called twice with the same paymentId', () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any

    const result1 = finalizePayment(db, fee, 'mp-dup-test', 189.90, 'pix')
    const result2 = finalizePayment(db, fee, 'mp-dup-test', 189.90, 'pix')

    expect(result1).toBe(true)
    expect(result2).toBe(false)
    const payments = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').all(fid)
    expect(payments.length).toBe(1)
  })

  it('should return false when fee is already paid', () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any

    const result = finalizePayment(db, fee, 'mp-already-paid', 189.90, 'pix')
    expect(result).toBe(false)
  })
})

describe('recordOverpayment — Regra de Ouro', () => {
  it('should record overpayment when fee is already paid', () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any

    recordOverpayment(db, fee, 'mp-overpay-1', 189.90, 'pix')

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(payments.length).toBe(1)
    expect(payments[0].amount).toBe(189.90)
  })

  it('should not record duplicate overpayment for the same paymentId', () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any

    recordOverpayment(db, fee, 'mp-overpay-dup', 189.90, 'pix')
    recordOverpayment(db, fee, 'mp-overpay-dup', 189.90, 'pix')

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(fid)
    expect(payments.length).toBe(1)
  })

  it('should mark charge as succeeded_overpaid', () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'paid' })
    const db = getDb()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(fid) as any
    const chargeId = uuid()
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-charge-overpay', ?, 189.90, 'superseded')").run(chargeId, fid)

    recordOverpayment(db, fee, 'mp-charge-overpay', 189.90, 'pix', chargeId)

    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('succeeded_overpaid')
  })
})

describe('POST /api/payments/create — rejected fee statuses', () => {
  it('should reject cancelled fees', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'cancelled' })
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('cancelada')
  })

  it('should reject exempt fees', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'exempt' })
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('isenta')
  })
})
