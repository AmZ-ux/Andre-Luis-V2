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
import { paymentsRouter, handleAsaasWebhook } from '../routes/payments.js'

process.env.DATABASE_PATH = ':memory:'
delete process.env.ASAAS_API_KEY

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.post('/api/asaas/webhook', handleAsaasWebhook)
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

describe('POST /api/payments/create (sem ASAAS_API_KEY)', () => {
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

  it('should fail with clear message when Asaas key is missing', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app).post('/api/payments/create').set('Authorization', `Bearer ${token}`).send({ monthlyFeeId: fid, method: 'pix' })
    expect(res.status).toBe(502)
    expect(res.body.error).toContain('ASAAS_API_KEY')
  })
})

describe('POST /api/asaas/webhook', () => {
  it('should reject events without payment', async () => {
    const res = await request(app).post('/api/asaas/webhook').send({ event: 'PAYMENT_RECEIVED' })
    expect(res.status).toBe(400)
  })

  it('should ack unknown events without error', async () => {
    const res = await request(app).post('/api/asaas/webhook').send({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1', value: 189.9 } })
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })
})
