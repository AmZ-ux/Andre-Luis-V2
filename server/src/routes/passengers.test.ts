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
import passengersRoutes from '../routes/passengers.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/passengers', authMiddleware, passengersRoutes)

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

describe('GET /api/passengers', () => {
  it('should return empty list when no passengers exist', async () => {
    const res = await request(app).get('/api/passengers').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return paginated passengers', async () => {
    const db = getDb()
    for (let i = 0; i < 3; i++) {
      const id = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
        .run(id, `Passenger ${i}`, `000.000.000-${String(i).padStart(2, '0')}`, '2000-01-01')
    }
    const res = await request(app).get('/api/passengers').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    expect(res.body.total).toBe(3)
  })

  it('should filter by status', async () => {
    const db = getDb()
    const id1 = uuid(); const id2 = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id1, 'Active One', '111.111.111-11', '2000-01-01')
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'inactive')")
      .run(id2, 'Inactive One', '222.222.222-22', '2000-01-01')
    const res = await request(app).get('/api/passengers?status=active').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Active One')
  })
})

describe('GET /api/passengers/:id', () => {
  it('should return passenger by id', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Test Passenger', '333.333.333-33', '2000-01-01')
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Test Passenger')
    expect(res.body.cpf).toBe('333.333.333-33')
  })

  it('should return 404 for non-existent passenger', async () => {
    const res = await request(app).get('/api/passengers/non-existent-id').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Passageiro não encontrado')
  })
})

describe('POST /api/passengers', () => {
  it('should create a new passenger', async () => {
    const res = await request(app)
      .post('/api/passengers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Passenger',
        cpf: '444.444.444-44',
        birthDate: '1995-06-15',
        phone: '11999999999',
        email: 'passenger@test.com',
        transportType: 'university',
        monthlyFee: 189.90,
        dueDay: 5,
      })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.name).toBe('New Passenger')
    expect(res.body.cpf).toBe('444.444.444-44')
  })

  it('should create a user when passenger CPF is new', async () => {
    const res = await request(app)
      .post('/api/passengers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'User Passenger',
        cpf: '555.555.555-55',
        birthDate: '1990-01-01',
        email: 'userpass@test.com',
        transportType: 'university',
        monthlyFee: 150,
        dueDay: 10,
      })
    expect(res.status).toBe(201)
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE cpf = ?').get('555.555.555-55')
    expect(user).toBeTruthy()
    expect(user!.role).toBe('passenger')
  })

  it('should return 500 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/passengers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Incomplete' })
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/passengers/:id', () => {
  it('should update a passenger', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(id, 'Old Name', '666.666.666-66', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', monthly_fee: 200 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.monthly_fee).toBe(200)
  })

  it('should return 404 when passenger not found', async () => {
    const res = await request(app)
      .put('/api/passengers/non-existent')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Passageiro não encontrado')
  })

  it('should return 400 when no fields to update', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'No Update', '777.777.777-77', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Nenhum campo para atualizar')
  })
})

describe('DELETE /api/passengers/:id', () => {
  it('should delete a passenger', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'To Delete', '888.888.888-88', '2000-01-01')
    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const deleted = db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)
    expect(deleted).toBeUndefined()
  })

  it('should succeed even if passenger does not exist', async () => {
    const res = await request(app).delete('/api/passengers/non-existent').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/passengers')
    expect(res.status).toBe(401)
  })
})
