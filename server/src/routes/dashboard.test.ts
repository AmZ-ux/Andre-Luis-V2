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
import dashboardRoutes from '../routes/dashboard.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/dashboard', authMiddleware, dashboardRoutes)

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

function seedPassenger(): string {
  const db = getDb()
  const id = uuid()
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
    .run(id, 'Test Passenger', '111.111.111-11', '2000-01-01')
  return id
}

function seedMonthlyFee(passengerId: string, overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, passengerId,
    overrides.passengerName ?? 'Test Passenger',
    overrides.cpf ?? '111.111.111-11',
    overrides.transportType ?? 'university',
    overrides.month ?? 7, overrides.year ?? 2026,
    overrides.amount ?? 189.90,
    overrides.dueDay ?? 5,
    `${String(overrides.month ?? 7).padStart(2, '0')}/2026`,
    overrides.status ?? 'pending'
  )
  return id
}

describe('GET /api/dashboard', () => {
  it('should return dashboard with all zeros when no data exists', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('financialSummary')
    expect(res.body).toHaveProperty('statistics')
    expect(res.body).toHaveProperty('recentActivities')
    expect(res.body).toHaveProperty('upcomingPayments')
    expect(res.body).toHaveProperty('notifications')
    expect(res.body).toHaveProperty('chartData')
    expect(res.body.financialSummary.expectedRevenue).toBe(0)
    expect(res.body.financialSummary.receivedRevenue).toBe(0)
    expect(res.body.statistics).toHaveLength(7)
  })

  it('should reflect active passengers count', async () => {
    seedPassenger()
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const activeStat = res.body.statistics.find((s: any) => s.id === '1')
    expect(activeStat).toBeTruthy()
    expect(activeStat.value).toBe('1')
  })

  it('should reflect pending monthly fees', async () => {
    const pid = seedPassenger()
    seedMonthlyFee(pid, { status: 'pending', month: 7, year: 2026 })
    seedMonthlyFee(pid, { status: 'paid', month: 6, year: 2026 })
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const pendingStat = res.body.statistics.find((s: any) => s.id === '2')
    expect(pendingStat).toBeTruthy()
    expect(Number(pendingStat.value)).toBeGreaterThanOrEqual(1)
  })

  it('should include chart data with 12 months', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.chartData).toHaveLength(12)
    expect(res.body.chartData[0]).toHaveProperty('label')
    expect(res.body.chartData[0]).toHaveProperty('receita')
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/dashboard')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/dashboard/chart', () => {
  function seedPaidFee(passengerId: string, paymentDate: string, month: number, year: number, amount: number) {
    const db = getDb()
    const mfid = seedMonthlyFee(passengerId, { status: 'paid', month, year, amount })
    db.prepare('INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), mfid, amount, paymentDate, 'pix')
    return mfid
  }

  it('should return 400 for invalid period', async () => {
    const res = await request(app).get('/api/dashboard/chart?period=abc').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('should return 12 monthly buckets with real values', async () => {
    const pid = seedPassenger()
    seedPaidFee(pid, '15/07/2026', 7, 2026, 189.90)
    seedPaidFee(pid, '10/07/2026', 7, 2026, 150.00)
    seedMonthlyFee(pid, { status: 'overdue', month: 6, year: 2026, amount: 200.00 })

    const res = await request(app).get('/api/dashboard/chart?period=12m').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(12)
    const july = res.body[6]
    expect(july.label).toBe('Jul')
    expect(july.receita).toBe(339.9)
    expect(july.pagamentos).toBe(2)
    const june = res.body[5]
    expect(june.inadimplencia).toBe(200)
  })

  it('should return 7 daily buckets from payment dates', async () => {
    const pid = seedPassenger()
    const now = new Date()
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    seedPaidFee(pid, fmt(now), now.getMonth() + 1, now.getFullYear(), 100.00)

    const res = await request(app).get('/api/dashboard/chart?period=7d').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(7)
    const withPayment = res.body.filter((b: any) => b.pagamentos > 0)
    expect(withPayment).toHaveLength(1)
    expect(withPayment[0].receita).toBe(100)
  })

  it('should return 4 weekly buckets for 30d', async () => {
    const res = await request(app).get('/api/dashboard/chart?period=30d').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(4)
    expect(res.body[0].label).toBe('Sem 1')
  })
})
