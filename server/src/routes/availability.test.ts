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
import availabilityRoutes from '../routes/availability.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/availabilities', authMiddleware, availabilityRoutes)

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
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
    .run(id, 'Test Passenger', `111.111.111-${String(passCounter).padStart(2, '0')}`, '2000-01-01')
  return id
}

function seedAvailability(overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  const pid = overrides.passengerId ?? seedPassenger()
  db.prepare(`
    INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, reason, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, pid,
    overrides.passengerName ?? 'Test Passenger',
    overrides.cpf ?? '111.111.111-11',
    overrides.transportType ?? 'university',
    overrides.type ?? 'vacation',
    overrides.startDate ?? '01/07/2026',
    overrides.endDate ?? '15/07/2026',
    overrides.reason ?? 'Férias',
    overrides.notes ?? '',
    overrides.status ?? 'scheduled'
  )
  return id
}

describe('GET /api/availabilities', () => {
  it('should return empty list when no availabilities exist', async () => {
    const res = await request(app).get('/api/availabilities').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return paginated availabilities', async () => {
    seedAvailability()
    seedAvailability()
    const res = await request(app).get('/api/availabilities').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.total).toBe(2)
  })

  it('should filter by status', async () => {
    seedAvailability({ status: 'scheduled' })
    seedAvailability({ status: 'active' })
    const res = await request(app).get('/api/availabilities?status=active').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].status).toBe('active')
  })
})

describe('GET /api/availabilities/summary', () => {
  it('should return summary stats', async () => {
    seedAvailability({ status: 'active', startDate: '01/07/2026', endDate: '30/07/2026' })
    seedAvailability({ status: 'scheduled', startDate: '01/08/2026', endDate: '15/08/2026' })
    const res = await request(app).get('/api/availabilities/summary').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('onVacation')
    expect(res.body).toHaveProperty('future')
    expect(res.body).toHaveProperty('total')
    expect(res.body.onVacation).toBe(1)
    expect(res.body.future).toBe(1)
    expect(res.body.total).toBe(2)
  })

  it('should return zeros when no availabilities', async () => {
    const res = await request(app).get('/api/availabilities/summary').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.onVacation).toBe(0)
    expect(res.body.total).toBe(0)
  })
})

describe('GET /api/availabilities/:id', () => {
  it('should return availability with history', async () => {
    const aid = seedAvailability()
    const res = await request(app).get(`/api/availabilities/${aid}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('availability')
    expect(res.body).toHaveProperty('history')
    expect(res.body.availability.id).toBe(aid)
  })

  it('should return 404 for non-existent availability', async () => {
    const res = await request(app).get('/api/availabilities/non-existent').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Período não encontrado')
  })
})

describe('POST /api/availabilities', () => {
  it('should create a new availability', async () => {
    const pid = seedPassenger()
    const res = await request(app)
      .post('/api/availabilities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passengerId: pid,
        passengerName: 'Test Passenger',
        cpf: '111.111.111-11',
        transportType: 'university',
        type: 'vacation',
        startDate: '01/07/2026',
        endDate: '15/07/2026',
        reason: 'Férias escolares',
      })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.status).toBe('scheduled')
    expect(res.body.start_date).toBe('01/07/2026')
    expect(res.body.end_date).toBe('15/07/2026')
  })

  it('should create history entry on creation', async () => {
    const pid = seedPassenger()
    const res = await request(app)
      .post('/api/availabilities')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passengerId: pid,
        passengerName: 'Test Passenger',
        cpf: '111.111.111-11',
        transportType: 'university',
        startDate: '01/07/2026',
        endDate: '15/07/2026',
        reason: 'Férias',
      })
    expect(res.status).toBe(201)
    const db = getDb()
    const history = db.prepare('SELECT * FROM availability_history WHERE availability_id = ?').all(res.body.id)
    expect(history).toHaveLength(1)
    expect(history[0].action).toBe('created')
  })

  it('should return 500 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/availabilities')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/availabilities/:id/cancel', () => {
  it('should cancel an availability', async () => {
    const aid = seedAvailability()
    const res = await request(app)
      .put(`/api/availabilities/${aid}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Mudança de planos' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('cancelled')
    expect(res.body.cancellation_reason).toBe('Mudança de planos')
  })

  it('should return 404 when availability not found', async () => {
    const res = await request(app)
      .put('/api/availabilities/non-existent/cancel')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Cancelado' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Período não encontrado')
  })

  it('should create history entry on cancel', async () => {
    const aid = seedAvailability()
    await request(app)
      .put(`/api/availabilities/${aid}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Cancelado pelo admin' })
    const db = getDb()
    const history = db.prepare('SELECT * FROM availability_history WHERE availability_id = ?').all(aid)
    const cancelEntry = history.find((h: any) => h.action === 'cancelled')
    expect(cancelEntry).toBeTruthy()
    expect(cancelEntry!.notes).toBe('Cancelado pelo admin')
  })
})
