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
})
