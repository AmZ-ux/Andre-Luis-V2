import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import fs from 'fs'
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
  fs.rmSync(process.env.BACKUP_DIR!, { recursive: true, force: true })
  fs.mkdirSync(process.env.BACKUP_DIR!, { recursive: true })
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

  it('should merge with previously saved values (no data loss)', async () => {
    const db = getDb()
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
      .run(uuid(), 'financial', JSON.stringify({ currency: 'BRL', currencyFormat: 'BRL', decimalPlaces: 2, defaultDueDay: 5, allowCustomDueDate: true, defaultMonthlyFee: 250, allowDiscount: false, allowLateFee: false, allowInterest: false }))
    const res = await request(app)
      .put('/api/settings/financial')
      .set('Authorization', `Bearer ${token}`)
      .send({ allowDiscount: true })
    expect(res.status).toBe(200)
    expect(res.body.financial.defaultMonthlyFee).toBe(250)
    expect(res.body.financial.allowDiscount).toBe(true)
    expect(res.body.financial.currency).toBe('BRL')
  })

  it('should write audit log and app log on update', async () => {
    const db = getDb()
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
      .run(uuid(), 'company', JSON.stringify({ name: 'Old Co' }))
    await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Audited Co' })
    const audit = db.prepare('SELECT * FROM audit_logs').all() as any[]
    expect(audit.length).toBeGreaterThan(0)
    expect(audit[0].action).toBe('settings_update')
    const logs = db.prepare('SELECT * FROM app_logs').all() as any[]
    expect(logs.some((l) => l.action === 'settings_update')).toBe(true)
  })
})

describe('Backup endpoints', () => {
  it('should create and list a backup', async () => {
    const db = getDb()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(uuid(), 'Passenger One', '111.111.111-11', '2000-01-01')
    const created = await request(app).post('/api/settings/backup').set('Authorization', `Bearer ${token}`)
    expect(created.status).toBe(200)
    expect(created.body).toHaveProperty('id')

    const res = await request(app).get('/api/settings/backups').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(created.body.id)
  })

  it('should restore a backup', async () => {
    const db = getDb()
    const passengerId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(passengerId, 'Original', '111.111.111-11', '2000-01-01')
    await request(app).post('/api/settings/backup').set('Authorization', `Bearer ${token}`)

    db.prepare('DELETE FROM passengers').run()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'blocked')")
      .run(passengerId, 'Changed', '111.111.111-11', '2000-01-01')

    const list = await request(app).get('/api/settings/backups').set('Authorization', `Bearer ${token}`)
    const restored = await request(app)
      .post(`/api/settings/backups/${list.body[0].id}/restore`)
      .set('Authorization', `Bearer ${token}`)
    expect(restored.status).toBe(200)
    expect(restored.body.success).toBe(true)

    const row = db.prepare('SELECT * FROM passengers WHERE id = ?').get(passengerId) as any
    expect(row.name).toBe('Original')
    expect(row.status).toBe('active')
  })

  it('should return 404 when restoring a missing backup', async () => {
    const res = await request(app)
      .post('/api/settings/backups/missing-id/restore')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('should delete a backup', async () => {
    await request(app).post('/api/settings/backup').set('Authorization', `Bearer ${token}`)
    const list = await request(app).get('/api/settings/backups').set('Authorization', `Bearer ${token}`)
    const res = await request(app)
      .delete(`/api/settings/backups/${list.body[0].id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
    const after = await request(app).get('/api/settings/backups').set('Authorization', `Bearer ${token}`)
    expect(after.body).toHaveLength(0)
  })

  it('should download a backup file', async () => {
    const created = await request(app).post('/api/settings/backup').set('Authorization', `Bearer ${token}`)
    const res = await request(app)
      .get(`/api/settings/backups/${created.body.id}/download`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(JSON.parse(res.text)._meta).toBeDefined()
  })

  it('should return 400 for path traversal in backup id', async () => {
    const res = await request(app)
      .post('/api/settings/backups/..%2F..%2Fetc%2Fpasswd/restore')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    const del = await request(app)
      .delete('/api/settings/backups/..%2F..%2Fetc%2Fpasswd')
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(400)
  })
})

describe('GET /api/settings/logs', () => {
  it('should return empty logs initially', async () => {
    const res = await request(app).get('/api/settings/logs').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return logged actions and clear them', async () => {
    await request(app)
      .put('/api/settings/company')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Log Co' })
    const res = await request(app).get('/api/settings/logs').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('action')

    const cleared = await request(app).delete('/api/settings/logs').set('Authorization', `Bearer ${token}`)
    expect(cleared.status).toBe(204)
    const after = await request(app).get('/api/settings/logs').set('Authorization', `Bearer ${token}`)
    expect(after.body.data).toEqual([])
  })

  it('should require admin', async () => {
    const passengerId = uuid()
    const db = getDb()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passengerId, 'Pass', 'pass@test.com', '555.555.555-55', '', bcrypt.hashSync('pass', 10))
    const passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')
    const res = await request(app).get('/api/settings/logs').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
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
