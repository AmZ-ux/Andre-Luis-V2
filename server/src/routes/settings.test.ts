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
import settingsRoutes from '../routes/settings.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/settings', authMiddleware, settingsRoutes)

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

describe('GET /api/settings', () => {
  it('should return default settings when no settings exist', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('company')
    expect(res.body).toHaveProperty('financial')
    expect(res.body).toHaveProperty('billing')
    expect(res.body).toHaveProperty('communication')
    expect(res.body).toHaveProperty('security')
    expect(res.body).toHaveProperty('appearance')
    expect(res.body).toHaveProperty('system')
    expect(res.body).toHaveProperty('users')
    expect(res.body.company.name).toBe('Transporte André Luis')
    expect(res.body.financial.defaultMonthlyFee).toBe(189.90)
  })

  it('should return saved settings from database', async () => {
    const db = getDb()
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
      .run(uuid(), 'company', JSON.stringify({ name: 'My Transport', tradingName: 'My Transport', cnpj: '12.345.678/0001-90', phone: '', whatsapp: '', email: '', website: '', address: '', city: '', state: '', zipCode: '', logo: '', coverImage: '', description: '' }))
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.company.name).toBe('My Transport')
    expect(res.body.company.cnpj).toBe('12.345.678/0001-90')
  })
})

describe('PUT /api/settings/:category', () => {
  it('should update an existing settings category', async () => {
    const db = getDb()
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
      .run(uuid(), 'financial', JSON.stringify({ currency: 'BRL', currencyFormat: 'BRL', decimalPlaces: 2, defaultDueDay: 5, allowCustomDueDate: true, defaultMonthlyFee: 189.90, allowDiscount: false, allowLateFee: false, allowInterest: false }))
    const res = await request(app)
      .put('/api/settings/financial')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'USD', defaultMonthlyFee: 250, allowDiscount: true })
    expect(res.status).toBe(200)
    expect(res.body.financial.currency).toBe('USD')
    expect(res.body.financial.defaultMonthlyFee).toBe(250)
    expect(res.body.financial.allowDiscount).toBe(true)
  })

  it('should create a new settings category if it does not exist', async () => {
    const res = await request(app)
      .put('/api/settings/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', primaryColor: '#000000' })
    expect(res.status).toBe(200)
    expect(res.body.appearance.theme).toBe('dark')
    expect(res.body.appearance.primaryColor).toBe('#000000')
  })

  it('should merge with defaults for other categories', async () => {
    const res = await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Co' })
    expect(res.status).toBe(200)
    expect(res.body.company.name).toBe('Updated Co')
    expect(res.body.financial.defaultMonthlyFee).toBe(189.90)
  })
})

describe('GET /api/settings/users', () => {
  it('should return list of users', async () => {
    const db = getDb()
    const otherId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(otherId, 'Passenger', 'pass@test.com', '333.333.333-33', '', bcrypt.hashSync('pass', 10))
    const res = await request(app).get('/api/settings/users').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    const names = res.body.map((u: any) => u.name)
    expect(names).toContain('Admin')
    expect(names).toContain('Passenger')
  })

  it('should return safe fields without password_hash', async () => {
    const res = await request(app).get('/api/settings/users').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body[0]).not.toHaveProperty('password_hash')
    expect(res.body[0]).toHaveProperty('name')
    expect(res.body[0]).toHaveProperty('email')
    expect(res.body[0]).toHaveProperty('role')
  })
})

describe('GET /api/settings/audit', () => {
  it('should return empty audit logs', async () => {
    const res = await request(app).get('/api/settings/audit').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return paginated audit logs', async () => {
    const db = getDb()
    for (let i = 0; i < 3; i++) {
      db.prepare('INSERT INTO audit_logs (id, user_id, user_name, action, category, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuid(), adminId, 'Admin', `action-${i}`, 'test', '{}')
    }
    const res = await request(app).get('/api/settings/audit').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    expect(res.body.total).toBe(3)
  })

  it('should paginate audit logs correctly', async () => {
    const db = getDb()
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO audit_logs (id, user_id, user_name, action, category, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuid(), adminId, 'Admin', `action-${i}`, 'test', '{}')
    }
    const res = await request(app).get('/api/settings/audit?page=1&pageSize=2').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.total).toBe(5)
  })
})
