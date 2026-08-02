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
import monthlyFeesRoutes from '../routes/monthlyFees.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/monthly-fees', authMiddleware, monthlyFeesRoutes)

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

let mfPassCounter = 0

function seedPassenger(): string {
  const db = getDb()
  const id = uuid()
  mfPassCounter++
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
    .run(id, 'Test Passenger', `111.111.111-${String(mfPassCounter).padStart(2, '0')}`, '2000-01-01')
  return id
}

function seedMonthlyFee(passengerId: string, overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  const month = overrides.month ?? 7
  const year = overrides.year ?? 2026
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, passengerId,
    overrides.passengerName ?? 'Test Passenger',
    overrides.cpf ?? '111.111.111-11',
    overrides.transportType ?? 'university',
    month, year,
    overrides.amount ?? 189.90,
    overrides.dueDay ?? 5,
    `${String(month).padStart(2, '0')}/${year}`,
    overrides.status ?? 'pending'
  )
  return id
}

describe('GET /api/monthly-fees', () => {
  it('should return empty list when no fees exist', async () => {
    const res = await request(app).get('/api/monthly-fees').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return paginated fees', async () => {
    const pid = seedPassenger()
    seedMonthlyFee(pid, { month: 7, year: 2026 })
    seedMonthlyFee(pid, { month: 8, year: 2026 })
    const res = await request(app).get('/api/monthly-fees').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.total).toBe(2)
  })

  it('should filter by month and year', async () => {
    const pid = seedPassenger()
    seedMonthlyFee(pid, { month: 7, year: 2026 })
    seedMonthlyFee(pid, { month: 8, year: 2026 })
    const res = await request(app).get('/api/monthly-fees?month=7&year=2026').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].month).toBe(7)
  })

  it('should filter by status', async () => {
    const pid = seedPassenger()
    seedMonthlyFee(pid, { status: 'pending' })
    seedMonthlyFee(pid, { status: 'paid' })
    const res = await request(app).get('/api/monthly-fees?status=paid').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].status).toBe('paid')
  })
})

describe('GET /api/monthly-fees/:id', () => {
  it('should return fee by id with payment', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app).get(`/api/monthly-fees/${fid}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(fid)
    expect(res.body).toHaveProperty('payment')
  })

  it('should return 404 for non-existent fee', async () => {
    const res = await request(app).get('/api/monthly-fees/non-existent').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Mensalidade não encontrada')
  })

  it('should include payment data when payment exists', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const db = getDb()
    const payId = uuid()
    db.prepare('INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?, ?)')
      .run(payId, fid, 189.90, '15/07/2026', 'pix')
    const res = await request(app).get(`/api/monthly-fees/${fid}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.payment).toBeTruthy()
    expect(res.body.payment.amount).toBe(189.90)
    expect(res.body.payment.payment_method).toBe('pix')
  })
})

describe('POST /api/monthly-fees', () => {
  it('should create a new monthly fee', async () => {
    const pid = seedPassenger()
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passengerId: pid,
        passengerName: 'Test Passenger',
        cpf: '111.111.111-11',
        transportType: 'university',
        month: 7,
        year: 2026,
        amount: 189.90,
        dueDay: 5,
      })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.status).toBe('pending')
    expect(res.body.amount).toBe(189.90)
    expect(res.body.due_date).toBe('05/07/2026')
  })

  it('should return 500 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/monthly-fees/:id', () => {
  it('should update a monthly fee', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250, dueDay: 10, status: 'paid' })
    expect(res.status).toBe(200)
    expect(res.body.amount).toBe(250)
    expect(res.body.due_day).toBe(10)
    expect(res.body.status).toBe('paid')
  })

  it('should return 404 when fee not found', async () => {
    const res = await request(app)
      .put('/api/monthly-fees/non-existent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 150 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Mensalidade não encontrada')
  })
})

describe('POST /api/monthly-fees/:id/pay', () => {
  it('should register a payment for a fee', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .post(`/api/monthly-fees/${fid}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 189.90, paymentDate: '15/07/2026', paymentMethod: 'pix' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('paid')
    expect(res.body.payment).toBeTruthy()
    expect(res.body.payment.amount).toBe(189.90)
    expect(res.body.payment.payment_method).toBe('pix')
  })

  it('should return 404 when fee not found', async () => {
    const res = await request(app)
      .post('/api/monthly-fees/non-existent/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, paymentDate: '01/01/2026', paymentMethod: 'cash' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Mensalidade não encontrada')
  })

  it('should return 400 when payment fields are missing', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .post(`/api/monthly-fees/${fid}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('obrigatórios')
  })

  it('should reject duplicate payments', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const payload = { amount: 189.90, paymentDate: '15/07/2026', paymentMethod: 'pix' }
    const first = await request(app).post(`/api/monthly-fees/${fid}/pay`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(first.status).toBe(200)
    const second = await request(app).post(`/api/monthly-fees/${fid}/pay`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(second.status).toBe(400)
    expect(second.body.error).toBe('Pagamento já registrado para esta mensalidade')
  })

  it('should reject payment for cancelled and exempt fees', async () => {
    const pid = seedPassenger()
    const cancelledId = seedMonthlyFee(pid, { status: 'cancelled', cpf: '111.111.111-20' })
    const exemptId = seedMonthlyFee(pid, { status: 'exempt', cpf: '111.111.111-21', month: 6 })
    const payload = { amount: 189.90, paymentDate: '15/07/2026', paymentMethod: 'pix' }
    const res1 = await request(app).post(`/api/monthly-fees/${cancelledId}/pay`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(res1.status).toBe(400)
    const res2 = await request(app).post(`/api/monthly-fees/${exemptId}/pay`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(res2.status).toBe(400)
  })

  it('should apply late fee and interest when configured and fee is overdue', async () => {
    const db = getDb()
    db.prepare("INSERT INTO settings (id, category, data) VALUES (?, 'billing', ?)").run(
      uuid(),
      JSON.stringify({ autoChargeLateFee: true, autoChargeInterest: true, toleranceDays: 0, lateFeePercent: 2, interestRatePerDay: 0.033 })
    )
    const pid = seedPassenger()
    // due 01/07/2026, payment registered today => daysLate > 0
    const fid = seedMonthlyFee(pid, { month: 7, year: 2026, dueDay: 1 })
    const res = await request(app)
      .post(`/api/monthly-fees/${fid}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentDate: '05/07/2026', paymentMethod: 'pix' })
    expect(res.status).toBe(200)
    expect(res.body.payment.late_fee).toBe(3.8)
    expect(res.body.payment.interest).toBeGreaterThan(0)
    expect(res.body.breakdown).toBeTruthy()
    expect(res.body.breakdown.total).toBe(res.body.payment.amount)
  })

  it('should create a notification for the passenger on payment', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    await request(app)
      .post(`/api/monthly-fees/${fid}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 189.90, paymentDate: '15/07/2026', paymentMethod: 'pix' })
    const notifications = getDb().prepare('SELECT * FROM notifications WHERE user_id = ?').all(pid)
    expect(notifications.length).toBe(1)
    expect(notifications[0].title).toBe('Pagamento registrado')
  })
})

describe('POST /api/monthly-fees/ensure-current', () => {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  function seedPassengerUser(status = 'active'): { pid: string; token: string } {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pid, 'Passenger', `pass-${pid}@test.com`, '999.999.999-99', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', ?, 189.90, 5)")
      .run(pid, 'Passenger', '999.999.999-99', '2000-01-01', status)
    const passengerToken = jwt.sign({ userId: pid, role: 'passenger' }, 'dev-secret-change-in-production')
    return { pid, token: passengerToken }
  }

  it('should create the current month fee on demand for a passenger', async () => {
    const { pid, token: passengerToken } = seedPassengerUser()
    const res = await request(app)
      .post('/api/monthly-fees/ensure-current')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ensured).toBe(true)
    expect(res.body.next.passenger_id).toBe(pid)
    expect(res.body.next.month).toBe(currentMonth)
    expect(res.body.next.year).toBe(currentYear)
    expect(res.body.next.status).toBe('pending')
  })

  it('should return the existing fee without duplicating', async () => {
    const { pid, token: passengerToken } = seedPassengerUser()
    const feeId = seedMonthlyFee(pid, { month: currentMonth, year: currentYear })
    const res = await request(app)
      .post('/api/monthly-fees/ensure-current')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.next.id).toBe(feeId)
    expect(res.body.ensured).toBe(false)
    const count = getDb().prepare('SELECT COUNT(*) as c FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
    expect(count.c).toBe(1)
  })

  it('should not generate fees for inactive passengers', async () => {
    const { token: passengerToken } = seedPassengerUser('inactive')
    const res = await request(app)
      .post('/api/monthly-fees/ensure-current')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.created).toBe(0)
    expect(res.body.next).toBeNull()
  })

  it('should deny admin users', async () => {
    const res = await request(app)
      .post('/api/monthly-fees/ensure-current')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('Role checks on admin-only endpoints', () => {
  function seedPassengerToken(): string {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pid, 'Passenger', `role-${pid}@test.com`, '999.999.999-99', '', bcrypt.hashSync('password', 10))
    return jwt.sign({ userId: pid, role: 'passenger' }, 'dev-secret-change-in-production')
  }

  it('should deny passenger creating a fee manually', async () => {
    const pid = seedPassenger()
    const passengerToken = seedPassengerToken()
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ passengerId: pid, passengerName: 'X', cpf: '111.111.111-11', transportType: 'university', month: 8, year: 2026, amount: 100, dueDay: 5 })
    expect(res.status).toBe(403)
  })

  it('should deny passenger registering a payment', async () => {
    const pid = seedPassenger()
    const feeId = seedMonthlyFee(pid)
    const passengerToken = seedPassengerToken()
    const res = await request(app)
      .post(`/api/monthly-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ amount: 189.9, paymentDate: '15/07/2026', paymentMethod: 'pix' })
    expect(res.status).toBe(403)
  })

  it('should deny passenger updating a fee', async () => {
    const pid = seedPassenger()
    const feeId = seedMonthlyFee(pid)
    const passengerToken = seedPassengerToken()
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ amount: 200 })
    expect(res.status).toBe(403)
  })
})
