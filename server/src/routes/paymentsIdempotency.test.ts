import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
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
import { createPixCharge, createCardPaymentLink } from '../services/mercadopagoService.js'

vi.mock('../services/mercadopagoService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/mercadopagoService.js')>()
  return {
    ...actual,
    createPixCharge: vi.fn(),
    createCardPaymentLink: vi.fn(),
  }
})

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
  vi.clearAllMocks()
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

function seedMonthlyFee(passengerId: string): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.90, 5, '08/2026', 'pending')
  `).run(id, passengerId, 'Test Passenger', '111.111.111-11')
  return id
}

function seedPendingCharge(feeId: string, opts: { paymentIntentId?: string; pixCode?: string | null; qrImage?: string | null } = {}): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, pix_code, qr_image)
    VALUES (?, ?, ?, 189.90, 'pending', ?, ?)
  `).run(id, opts.paymentIntentId ?? 'mp-concurrent', feeId, opts.pixCode ?? null, opts.qrImage ?? null)
  return id
}

function pixPayment(id: number, qrCode: string) {
  return {
    id,
    point_of_interaction: { transaction_data: { qr_code: qrCode, qr_code_base64: Buffer.from(qrCode).toString('base64') } },
  } as any
}

function chargeRows(feeId: string) {
  return getDb().prepare(
    'SELECT payment_intent_id, status, pix_code, qr_image FROM pix_charges WHERE monthly_fee_id = ? ORDER BY created_at ASC'
  ).all(feeId) as Array<{ payment_intent_id: string; status: string; pix_code: string | null; qr_image: string | null }>
}

describe('POST /api/payments/create — PIX idempotency (P1)', () => {
  it('should create a pending charge and return the QR', async () => {
    vi.mocked(createPixCharge).mockResolvedValue(pixPayment(1001, 'qr-1001'))
    const fid = seedMonthlyFee(seedPassenger())

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })

    expect(res.status).toBe(200)
    expect(res.body.paymentId).toBe('1001')
    expect(res.body.method).toBe('pix')
    expect(res.body.pixCode).toBe('qr-1001')
    expect(res.body.qrImage).toContain('data:image/png;base64,')
    expect(chargeRows(fid)).toEqual([
      { payment_intent_id: '1001', status: 'pending', pix_code: 'qr-1001', qr_image: res.body.qrImage },
    ])
  })

  it('should reuse the valid pending charge without calling MP again', async () => {
    vi.mocked(createPixCharge).mockResolvedValue(pixPayment(1002, 'qr-1002'))
    const fid = seedMonthlyFee(seedPassenger())

    const first = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })
    const second = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.paymentId).toBe('1002')
    expect(second.body.pixCode).toBe('qr-1002')
    expect(vi.mocked(createPixCharge)).toHaveBeenCalledTimes(1)
    expect(chargeRows(fid)).toHaveLength(1)
  })

  it('should keep the concurrent pending charge and record the new MP payment as superseded', async () => {
    const fid = seedMonthlyFee(seedPassenger())
    vi.mocked(createPixCharge).mockImplementation(async () => {
      // Simula outra requisição que gravou a pendente enquanto aguardávamos o MP
      seedPendingCharge(fid, {
        paymentIntentId: '2001-concurrent',
        pixCode: 'qr-concurrent',
        qrImage: 'data:image/png;base64,conc',
      })
      return pixPayment(2002, 'qr-2002')
    })

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })

    expect(res.status).toBe(200)
    expect(res.body.paymentId).toBe('2001-concurrent')
    expect(res.body.pixCode).toBe('qr-concurrent')

    const rows = chargeRows(fid)
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.status === 'pending')).toEqual([
      { payment_intent_id: '2001-concurrent', status: 'pending', pix_code: 'qr-concurrent', qr_image: 'data:image/png;base64,conc' },
    ])
    expect(rows.filter((r) => r.status === 'superseded')).toHaveLength(1)
    expect(rows.find((r) => r.status === 'superseded')?.payment_intent_id).toBe('2002')
  })

  it('should not duplicate when the parallel request recorded the same MP payment', async () => {
    const fid = seedMonthlyFee(seedPassenger())
    vi.mocked(createPixCharge).mockImplementation(async () => {
      seedPendingCharge(fid, {
        paymentIntentId: '3001',
        pixCode: 'qr-3001',
        qrImage: 'data:image/png;base64,same',
      })
      return pixPayment(3001, 'qr-3001')
    })

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })

    expect(res.status).toBe(200)
    expect(res.body.paymentId).toBe('3001')
    expect(chargeRows(fid)).toHaveLength(1)
    expect(chargeRows(fid)[0].status).toBe('pending')
  })

  it('should supersede a pending charge without QR data and issue a new one', async () => {
    const fid = seedMonthlyFee(seedPassenger())
    seedPendingCharge(fid, { paymentIntentId: 'legacy-1', pixCode: null, qrImage: null })
    vi.mocked(createPixCharge).mockResolvedValue(pixPayment(4001, 'qr-4001'))

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'pix' })

    expect(res.status).toBe(200)
    expect(res.body.paymentId).toBe('4001')

    const rows = chargeRows(fid)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.payment_intent_id === 'legacy-1')?.status).toBe('superseded')
    expect(rows.find((r) => r.payment_intent_id === '4001')?.status).toBe('pending')
  })
})

describe('POST /api/payments/create — card charge with a pending charge (P1)', () => {
  it('should not fail with UNIQUE constraint when a pending PIX charge exists', async () => {
    const fid = seedMonthlyFee(seedPassenger())
    seedPendingCharge(fid, { paymentIntentId: 'mp-pix-open', pixCode: 'qr-open', qrImage: 'data:image/png;base64,open' })
    vi.mocked(createCardPaymentLink).mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://mp.example/checkout/pref-1',
    } as any)

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'card' })

    expect(res.status).toBe(200)
    expect(res.body.method).toBe('card')
    expect(res.body.paymentId).toBe('pref-1')
    expect(res.body.paymentUrl).toBe('https://mp.example/checkout/pref-1')

    const rows = chargeRows(fid)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.payment_intent_id === 'mp-pix-open')?.status).toBe('superseded')
    expect(rows.find((r) => r.payment_intent_id === 'pref-1')?.status).toBe('pending')
  })

  it('should create a single pending card charge when none exists', async () => {
    const fid = seedMonthlyFee(seedPassenger())
    vi.mocked(createCardPaymentLink).mockResolvedValue({
      id: 'pref-2',
      init_point: 'https://mp.example/checkout/pref-2',
    } as any)

    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`)
      .send({ monthlyFeeId: fid, method: 'card' })

    expect(res.status).toBe(200)
    expect(chargeRows(fid)).toEqual([
      { payment_intent_id: 'pref-2', status: 'pending', pix_code: null, qr_image: null },
    ])
  })
})
