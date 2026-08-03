import { describe, it, expect, beforeAll, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb, getDb } from '../database/connection.js'
import adminRoutes from '../routes/admin.js'
import { getSuperAdminToken, getAdminToken, getPassengerToken } from './testUtils.js'

vi.hoisted(() => {
  process.env.DATABASE_PATH = ':memory:'
})

const app = express()
app.use(express.json())
app.use(sanitizeBody)
app.use('/api/admin', adminRoutes)

beforeAll(async () => {
  await runMigrations()
  resetDb()
})

describe('Admin management (super admin only)', () => {
  it('should block non-admin users', async () => {
    const res = await request(app)
      .get('/api/admin/admins')
      .set('Authorization', `Bearer ${getPassengerToken()}`)
    expect(res.status).toBe(403)
  })

  it('should block regular admins', async () => {
    const res = await request(app)
      .get('/api/admin/admins')
      .set('Authorization', `Bearer ${getAdminToken()}`)
    expect(res.status).toBe(403)
  })

  it('should require authentication', async () => {
    const res = await request(app).get('/api/admin/admins')
    expect(res.status).toBe(401)
  })

  it('should list admins for super admin', async () => {
    const res = await request(app)
      .get('/api/admin/admins')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('should create a new admin', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ name: 'André Luis', email: 'andreluis@transporte.com', password: 'Senha@1234' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('admin')
    expect(res.body.superAdmin).toBe(false)
    expect(res.body.emailVerified).toBe(true)
  })

  it('should reject creating admin with short password', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ name: 'Teste', email: 't@t.com', password: 'curta' })
    expect(res.status).toBe(400)
  })

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ name: 'Duplicado', email: 'andreluis@transporte.com', password: 'Senha@1234' })
    expect(res.status).toBe(409)
  })

  it('should promote a passenger to admin', async () => {
    const db = getDb()
    const passenger = db.prepare("SELECT id FROM users WHERE role = 'passenger'").get() as { id: string } | undefined
    if (!passenger) {
      const { v4 } = await import('uuid')
      const id = v4()
      db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', 'x')")
        .run(id, 'Passageiro', `p-${Date.now()}@teste.com`, `999.${Date.now() % 1000}.000-00`, '', )
    }
    const target = db.prepare("SELECT id FROM users WHERE role = 'passenger'").get() as { id: string }

    const res = await request(app)
      .post('/api/admin/promote')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ userId: target.id })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('admin')

    const updated = db.prepare('SELECT role FROM users WHERE id = ?').get(target.id) as { role: string }
    expect(updated.role).toBe('admin')
  })

  it('should demote an admin back to passenger', async () => {
    const db = getDb()
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND super_admin = 0").get() as { id: string } | undefined
    if (!admin) {
      const res = await request(app)
        .post('/api/admin/admins')
        .set('Authorization', `Bearer ${getSuperAdminToken()}`)
        .send({ name: 'Demote Teste', email: 'demote@teste.com', password: 'Senha@1234' })
      expect(res.status).toBe(201)
      const res2 = await request(app)
        .post('/api/admin/demote')
        .set('Authorization', `Bearer ${getSuperAdminToken()}`)
        .send({ userId: res.body.id })
      expect(res2.status).toBe(200)
      expect(res2.body.role).toBe('passenger')
      return
    }

    const res = await request(app)
      .post('/api/admin/demote')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ userId: admin.id })
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('passenger')
  })

  it('should not demote the super admin', async () => {
    const db = getDb()
    const superAdmin = db.prepare("SELECT id FROM users WHERE super_admin = 1").get() as { id: string } | undefined
    if (!superAdmin) return
    const res = await request(app)
      .post('/api/admin/demote')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ userId: superAdmin.id })
    expect(res.status).toBe(400)
  })

  it('should remove an admin and block its account', async () => {
    const res = await request(app)
      .post('/api/admin/admins')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
      .send({ name: 'Remover Teste', email: 'remove.me@teste.com', password: 'Senha@1234' })
    expect(res.status).toBe(201)
    expect(res.body.emailVerified).toBe(true)

    const del = await request(app)
      .delete(`/api/admin/admins/${res.body.id}`)
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
    expect(del.status).toBe(200)

    const db = getDb()
    const gone = db.prepare('SELECT id FROM users WHERE id = ?').get(res.body.id)
    expect(gone).toBeUndefined()
  })

  it('should not remove the super admin', async () => {
    const db = getDb()
    const superAdmin = db.prepare("SELECT id FROM users WHERE super_admin = 1").get() as { id: string } | undefined
    if (!superAdmin) return
    const res = await request(app)
      .delete(`/api/admin/admins/${superAdmin.id}`)
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/admin/reset-data', () => {
  it('should require super admin', async () => {
    const res = await request(app)
      .post('/api/admin/reset-data')
      .set('Authorization', `Bearer ${getAdminToken()}`)
    expect(res.status).toBe(403)
  })

  it('should clear operational data but keep super admin and settings', async () => {
    const db = getDb()
    const { v4 } = await import('uuid')

    const passengerId = v4()
    db.prepare(`
      INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day)
      VALUES (?, ?, ?, ?, 'university', 'active', 200, 5)
    `).run(passengerId, 'Teste Reset', '111.222.333-44', '1990-01-01')

    const feeId = v4()
    db.prepare(`
      INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
      VALUES (?, ?, ?, ?, 'university', 8, 2026, 200, 5, '05/08/2026', 'pending')
    `).run(feeId, passengerId, 'Teste Reset', '111.222.333-44')

    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, status, type)
      VALUES (?, ?, ?, ?, 'unread', 'info')
    `).run(v4(), passengerId, 'Notif Teste', 'msg')

    const res = await request(app)
      .post('/api/admin/reset-data')
      .set('Authorization', `Bearer ${getSuperAdminToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    expect(db.prepare('SELECT id FROM passengers').all()).toHaveLength(0)
    expect(db.prepare('SELECT id FROM monthly_fees').all()).toHaveLength(0)
    expect(db.prepare('SELECT id FROM notifications').all()).toHaveLength(0)

    const superAdmin = db.prepare("SELECT id, super_admin FROM users WHERE super_admin = 1").get() as any
    expect(superAdmin).toBeDefined()
    expect(db.prepare('SELECT id FROM users').all()).toHaveLength(1)
  })
})
