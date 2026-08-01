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
    expect(res.body.statistics).toHaveLength(8)
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

  it('should include pending receipts count', async () => {
    const pid = seedPassenger()
    const mfid = seedMonthlyFee(pid, { status: 'pending', month: 7, year: 2026 })
    const db = getDb()
    db.prepare(`
      INSERT INTO receipts (id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, file_name, file_type, file_size, file_data, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'awaiting')
    `).run(uuid(), mfid, pid, 'Test Passenger', '111.111.111-11', 'university', 7, 2026, 189.90, 'receipt.pdf', 'application/pdf', 1024)
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const receiptsStat = res.body.statistics.find((s: any) => s.id === '4')
    expect(receiptsStat).toBeTruthy()
    expect(Number(receiptsStat.value)).toBe(1)
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
