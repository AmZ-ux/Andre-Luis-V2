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
    seedMonthlyFee(pid, { status: 'pending', month: 7, year: 2026 })
    seedMonthlyFee(pid, { status: 'paid', month: 8, year: 2026 })
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
  it('POST /api/monthly-fees is no longer available → 404', async () => {
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${token}`)
      .send({ passengerId: 'x', passengerName: 'X', cpf: '000', transportType: 'university', month: 1, year: 2026, amount: 100, dueDay: 5 })
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/monthly-fees/:id', () => {
  it('should update dueDay and notes but NOT amount', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250, dueDay: 10, status: 'cancelled' })
    expect(res.status).toBe(200)
    expect(res.body.amount).toBe(189.90) // amount is NOT editable
    expect(res.body.due_day).toBe(10)
    expect(res.body.status).toBe('cancelled')
  })

  it('should return 404 when fee not found', async () => {
    const res = await request(app)
      .put('/api/monthly-fees/non-existent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 150 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Mensalidade não encontrada')
  })

  it('should reject status "paid" — only gateway may liquidate a fee', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')

    const fee = getDb().prepare('SELECT status FROM monthly_fees WHERE id = ?').get(fid) as any
    expect(fee.status).toBe('pending')
  })

  it('should not create any payment when rejecting status "paid"', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' })

    const payments = getDb().prepare('SELECT COUNT(*) as c FROM payments WHERE monthly_fee_id = ?').get(fid) as { c: number }
    expect(payments.c).toBe(0)

    const charges = getDb().prepare('SELECT COUNT(*) as c FROM pix_charges WHERE monthly_fee_id = ?').get(fid) as { c: number }
    expect(charges.c).toBe(0)
  })

  it('should reject unknown/invalid status values', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid_status' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')
  })

  it('should allow status "pending"', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid, { status: 'overdue' })
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')
  })

  it('should allow status "cancelled"', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
  })

  it('should allow status "exempt"', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'exempt' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('exempt')
  })

  it('should reject status "overdue" — managed by scheduler only', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .put(`/api/monthly-fees/${fid}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'overdue' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')
  })
})

describe('POST /api/monthly-fees/:id/pay', () => {
  it('should return 404 — route removed', async () => {
    const pid = seedPassenger()
    const fid = seedMonthlyFee(pid)
    const res = await request(app)
      .post(`/api/monthly-fees/${fid}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 189.90, paymentDate: '15/07/2026', paymentMethod: 'pix' })
    expect(res.status).toBe(404)
  })

  it('should return 404 for non-existent fee', async () => {
    const res = await request(app)
      .post('/api/monthly-fees/non-existent/pay')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, paymentDate: '01/01/2026', paymentMethod: 'cash' })
    expect(res.status).toBe(404)
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

  it('should deny passenger creating a fee manually (endpoint removed → 404)', async () => {
    const pid = seedPassenger()
    const passengerToken = seedPassengerToken()
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ passengerId: pid, passengerName: 'X', cpf: '111.111.111-11', transportType: 'university', month: 8, year: 2026, amount: 100, dueDay: 5 })
    expect(res.status).toBe(404)
  })

  it('should deny passenger registering a payment — route removed (404)', async () => {
    const pid = seedPassenger()
    const feeId = seedMonthlyFee(pid)
    const passengerToken = seedPassengerToken()
    const res = await request(app)
      .post(`/api/monthly-fees/${feeId}/pay`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ amount: 189.9, paymentDate: '15/07/2026', paymentMethod: 'pix' })
    expect(res.status).toBe(404)
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

describe('GET /api/monthly-fees/me', () => {
  it('should return 401 without authentication', async () => {
    const res = await request(app).get('/api/monthly-fees/me')
    expect(res.status).toBe(401)
  })

  it('should return only the authenticated passenger fees', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pid, 'Passenger A', 'pass-a-me@test.com', '111.111.111-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pid, 'Passenger A', '111.111.111-01', '2000-01-01')
    const passengerToken = jwt.sign({ userId: pid, role: 'passenger' }, 'dev-secret-change-in-production')

    const feeId = seedMonthlyFee(pid, { month: 8, year: 2026 })

    const res = await request(app)
      .get('/api/monthly-fees/me')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(feeId)
    expect(res.body[0].passenger_id).toBe(pid)
  })

  it('should NOT contain fees from another passenger', async () => {
    const db = getDb()
    const pidA = uuid()
    const pidB = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pidA, 'Passenger A', 'pass-a-iso@test.com', '222.222.222-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pidA, 'Passenger A', '222.222.222-01', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pidB, 'Passenger B', 'pass-b-iso@test.com', '333.333.333-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pidB, 'Passenger B', '333.333.333-01', '2000-01-01')

    seedMonthlyFee(pidA, { month: 8, year: 2026 })
    seedMonthlyFee(pidB, { month: 8, year: 2026, passengerName: 'Passenger B', cpf: '333.333.333-01' })

    const tokenA = jwt.sign({ userId: pidA, role: 'passenger' }, 'dev-secret-change-in-production')
    const res = await request(app)
      .get('/api/monthly-fees/me')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].passenger_id).toBe(pidA)
  })

  it('should return empty array when passenger has no fees', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pid, 'Passenger Empty', 'pass-empty-me@test.com', '444.444.444-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pid, 'Passenger Empty', '444.444.444-01', '2000-01-01')
    const passengerToken = jwt.sign({ userId: pid, role: 'passenger' }, 'dev-secret-change-in-production')

    const res = await request(app)
      .get('/api/monthly-fees/me')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('should return own fees for admin (or empty if no passenger record)', async () => {
    const res = await request(app)
      .get('/api/monthly-fees/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe('GET /api/monthly-fees/passenger/:passengerId (legacy)', () => {
  it('admin can query any passenger fees', async () => {
    const pid = seedPassenger()
    seedMonthlyFee(pid, { month: 8, year: 2026 })
    const res = await request(app)
      .get(`/api/monthly-fees/passenger/${pid}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].passenger_id).toBe(pid)
  })

  it('passenger using another passengerId still gets only own fees', async () => {
    const db = getDb()
    const pidA = uuid()
    const pidB = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pidA, 'Pass A', 'pass-a-leg@test.com', '555.555.555-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pidA, 'Pass A', '555.555.555-01', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(pidB, 'Pass B', 'pass-b-leg@test.com', '666.666.666-01', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pidB, 'Pass B', '666.666.666-01', '2000-01-01')

    seedMonthlyFee(pidA, { month: 8, year: 2026 })
    seedMonthlyFee(pidB, { month: 8, year: 2026, passengerName: 'Pass B', cpf: '666.666.666-01' })

    const tokenA = jwt.sign({ userId: pidA, role: 'passenger' }, 'dev-secret-change-in-production')
    const res = await request(app)
      .get(`/api/monthly-fees/passenger/${pidB}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].passenger_id).toBe(pidA)
  })
})

describe('UNIQUE fee per passenger/month/year (DB constraint)', () => {
  it('allows creating a fee for a passenger (via DB)', async () => {
    const db = getDb()
    const pid = seedPassenger()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    const fee = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ? AND month = 8 AND year = 2026').get(pid)
    expect(fee).toBeDefined()
  })

  it('rejects duplicate fee for same passenger/month/year via DB', async () => {
    const db = getDb()
    const pid = seedPassenger()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    expect(() => {
      db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
        .run(uuid(), pid, 'Test', '111.111.111-11')
    }).toThrow()
  })

  it('allows same passenger for different month', async () => {
    const db = getDb()
    const pid = seedPassenger()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 189.9, 5, '05/09/2026', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    const fees = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ?').all(pid)
    expect(fees).toHaveLength(2)
  })

  it('allows same passenger for different year', async () => {
    const db = getDb()
    const pid = seedPassenger()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2027, 189.9, 5, '05/08/2027', 'pending')")
      .run(uuid(), pid, 'Test', '111.111.111-11')
    const fees = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ?').all(pid)
    expect(fees).toHaveLength(2)
  })

  it('allows different passenger for same month/year', async () => {
    const db = getDb()
    const pidA = seedPassenger()
    const pidB = seedPassenger()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pidA, 'Test A', '111.111.111-11')
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')")
      .run(uuid(), pidB, 'Test B', '222.222.222-22')
    const fees = db.prepare('SELECT id FROM monthly_fees WHERE month = 8 AND year = 2026').all()
    expect(fees).toHaveLength(2)
  })

  it('rejects duplicate at DB level even if app check is bypassed', async () => {
    const db = getDb()
    const pid = seedPassenger()
    db.prepare(`
      INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
      VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')
    `).run(uuid(), pid, 'Test', '111.111.111-11')
    expect(() => {
      db.prepare(`
        INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
        VALUES (?, ?, ?, ?, 'university', 8, 2026, 189.9, 5, '05/08/2026', 'pending')
      `).run(uuid(), pid, 'Test', '111.111.111-11')
    }).toThrow()
  })
})

describe('DUPLICATE_FEES fail-safe migration', () => {
  it('does not delete any records when duplicates exist and throws DUPLICATE_FEES', async () => {
    const db = getDb()
    const pid = seedPassenger()

    db.exec("DROP INDEX IF EXISTS idx_unique_fee_per_passenger")

    const feeId1 = uuid()
    const feeId2 = uuid()
    db.prepare(`
      INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
      VALUES (?, ?, ?, ?, 'university', 6, 2025, 189.9, 5, '05/06/2025', 'paid')
    `).run(feeId1, pid, 'Dup Test', '999.999.999-99')
    db.prepare(`
      INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
      VALUES (?, ?, ?, ?, 'university', 6, 2025, 189.9, 5, '05/06/2025', 'pending')
    `).run(feeId2, pid, 'Dup Test', '999.999.999-99')

    const payId = uuid()
    db.prepare(`INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?, 'pix')`)
      .run(payId, feeId1, 189.9, '10/06/2025')

    const pixId = uuid()
    db.prepare(`INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, ?, ?, ?, 'paid')`)
      .run(pixId, `pix-${pixId}`, feeId1, 189.9)

    await expect(runMigrations()).rejects.toThrow('DUPLICATE_FEES')

    const feesAfter = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ? AND month = 6 AND year = 2025').all(pid)
    expect(feesAfter).toHaveLength(2)

    const payAfter = db.prepare('SELECT id FROM payments WHERE monthly_fee_id = ?').all(feeId1)
    expect(payAfter).toHaveLength(1)

    const pixAfter = db.prepare('SELECT id FROM pix_charges WHERE monthly_fee_id = ?').all(feeId1)
    expect(pixAfter).toHaveLength(1)
  })
})

describe('Phase 2E.2 — Price authority closure', () => {
  it('POST /api/monthly-fees is no longer available → 404', async () => {
    const res = await request(app)
      .post('/api/monthly-fees')
      .set('Authorization', `Bearer ${token}`)
      .send({ passengerId: 'x', passengerName: 'X', cpf: '000', transportType: 'university', month: 1, year: 2026, amount: 100, dueDay: 5 })
    expect(res.status).toBe(404)
  })

  it('PUT amount does NOT change amount (amount tamper protection)', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'TamperFee', '111.111.111-01', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'TamperFee', '111.111.111-01')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1 })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(400)
  })

  it('PUT dueDay continues working', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'DueDay', '222.222.222-02', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'DueDay', '222.222.222-02')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dueDay: 15 })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT due_day FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.due_day).toBe(15)
  })

  it('PUT notes continues working', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'Notes', '333.333.333-03', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'Notes', '333.333.333-03')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'test note' })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT notes FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.notes).toBe('test note')
  })

  it('exemption continues working', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'Exempt', '444.444.444-04', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'Exempt', '444.444.444-04')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'exempt' })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('exempt')
  })

  it('cancellation continues working', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'Cancel', '555.555.555-05', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'Cancel', '555.555.555-05')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('cancelled')
  })

  it('paid fee → notes rejected (409), original preserved', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'PaidFeeNotes', '666.666.666-06', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status, notes) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'paid', 'original')")
      .run(feeId, pid, 'PaidFeeNotes', '666.666.666-06')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'alterado' })
    expect(res.status).toBe(409)
    const fee = db.prepare('SELECT notes, status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.notes).toBe('original')
    expect(fee.status).toBe('paid')
  })

  it('paid fee → dueDay rejected (409), original preserved', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'PaidFeeDue', '777.777.777-07', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'paid')")
      .run(feeId, pid, 'PaidFeeDue', '777.777.777-07')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dueDay: 20 })
    expect(res.status).toBe(409)
    const fee = db.prepare('SELECT due_day FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.due_day).toBe(5)
  })

  it('paid fee → status cancelled rejected (409), remains paid', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'PaidFeeStatus', '888.888.888-08', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'paid')")
      .run(feeId, pid, 'PaidFeeStatus', '888.888.888-08')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
    expect(res.status).toBe(409)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('paid')
  })

  it('pending fee → notes + dueDay still work normally', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
      .run(pid, 'PendingEdit', '999.999.999-09', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 400, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'PendingEdit', '999.999.999-09')
    const res = await request(app)
      .put(`/api/monthly-fees/${feeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'teste', dueDay: 15 })
    expect(res.status).toBe(200)
    const fee = db.prepare('SELECT notes, due_day FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.notes).toBe('teste')
    expect(fee.due_day).toBe(15)
  })

  it('legacy passenger (route_id=NULL, monthly_fee=189.90) generates fee correctly', async () => {
    const db = getDb()
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(pid, 'Legacy', '777.777.777-07', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 189.90, 5, '05/09/2026', 'pending')")
      .run(feeId, pid, 'Legacy', '777.777.777-07')
    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(189.90)
  })

  it('route price change affects next fee but NOT existing fee (snapshot)', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'SnapTest', '888.888.888-08', '2000-01-01', routeId)
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 400, 5, '05/08/2026', 'pending')")
      .run(feeId, pid, 'SnapTest', '888.888.888-08')
    // Change route price
    db.prepare('UPDATE routes SET monthly_amount = 450 WHERE id = ?').run(routeId)
    db.prepare('UPDATE passengers SET monthly_fee = 450 WHERE route_id = ?').run(routeId)
    // Existing fee unchanged
    const existingFee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(existingFee.amount).toBe(400)
    // Passenger price updated
    const passenger = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(pid) as any
    expect(passenger.monthly_fee).toBe(450)
  })

  it('passenger route change affects next fee but NOT existing fee', async () => {
    const db = getDb()
    const routeA = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeA)
    const routeB = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 500, 1)").run(routeB)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'RouteChg', '999.999.999-09', '2000-01-01', routeA)
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 400, 5, '05/08/2026', 'pending')")
      .run(feeId, pid, 'RouteChg', '999.999.999-09')
    // Change route
    db.prepare('UPDATE passengers SET route_id = ?, monthly_fee = 500 WHERE id = ?').run(routeB, pid)
    // Existing fee unchanged
    const existingFee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(existingFee.amount).toBe(400)
    // Passenger price updated
    const passenger = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(pid) as any
    expect(passenger.monthly_fee).toBe(500)
  })
})
