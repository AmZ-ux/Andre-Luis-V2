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
import reportsRoutes from '../routes/reports.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/reports', authMiddleware, reportsRoutes)

let token: string
let adminId: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', '', bcrypt.hashSync('password', 10))
  token = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')
})

function seedData(): void {
  const db = getDb()
  const p1 = uuid()
  const p2 = uuid()
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, city, institution, transport_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(p1, 'Ana Silva', '111.111.111-11', '2000-01-01', 'São Paulo', 'USP', 'university', 'active')
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, city, institution, transport_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(p2, 'Bruno Souza', '222.222.222-22', '2001-02-02', 'Campinas', 'UNICAMP', 'school', 'active')

  const now = new Date()
  db.prepare('INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), p1, 'Ana Silva', '111.111.111-11', 'university', now.getMonth() + 1, now.getFullYear(), 200, 5, '05/01/2026', 'paid')
  db.prepare('INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), p2, 'Bruno Souza', '222.222.222-22', 'school', now.getMonth() + 1, now.getFullYear(), 150, 5, '05/01/2026', 'pending')

  db.prepare('INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), uuid(), 200, '2026-01-05', 'pix')
}

describe('GET /api/reports/overview', () => {
  it('should return empty aggregates when no data exists', async () => {
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.financial.totalPrevisto).toBe(0)
    expect(res.body.financial.totalRecebido).toBe(0)
    expect(res.body.financial.monthlyBreakdown).toHaveLength(12)
    expect(res.body.passengers.total).toBe(0)
    expect(res.body.availability.total).toBe(0)
  })

  it('should aggregate financial data correctly', async () => {
    seedData()
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.financial.totalPrevisto).toBe(350)
    expect(res.body.financial.totalRecebido).toBe(200)
    expect(res.body.financial.totalPendente).toBe(150)
    expect(res.body.financial.totalMensalidades).toBe(2)
    expect(res.body.financial.totalPagamentos).toBe(1)
    expect(res.body.financial.paymentMethodBreakdown).toHaveLength(1)
    expect(res.body.financial.paymentMethodBreakdown[0].method).toBe('pix')
  })

  it('should aggregate passengers by city and type', async () => {
    seedData()
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${token}`)
    expect(res.body.passengers.total).toBe(2)
    expect(res.body.passengers.ativos).toBe(2)
    expect(res.body.passengers.byCity).toHaveLength(2)
    expect(res.body.passengers.byTransportType).toHaveLength(2)
    expect(res.body.passengers.byTransportType.map((t: any) => t.type)).toContain('Universitário')
  })

  it('should require admin', async () => {
    const passengerId = uuid()
    const db = getDb()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passengerId, 'Pass', 'pass@test.com', '999.999.999-99', '', bcrypt.hashSync('pass', 10))
    const passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')
    const res = await request(app).get('/api/reports/overview').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })
})
