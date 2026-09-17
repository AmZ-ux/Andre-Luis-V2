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
import routesRoutes from '../routes/routes.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/routes', authMiddleware, routesRoutes)

let adminToken: string
let passengerToken: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  const adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', '', bcrypt.hashSync('password', 10))
  adminToken = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')

  const passengerId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
    .run(passengerId, 'Passenger', 'pass@test.com', '111.111.111-11', '', bcrypt.hashSync('password', 10))
  passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')
})

describe('POST /api/routes', () => {
  it('admin cria rota válida', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'Ipiranga do Piauí', destination: 'Universidade Federal', monthlyAmount: 400 })
    expect(res.status).toBe(201)
    expect(res.body.origin).toBe('Ipiranga do Piauí')
    expect(res.body.destination).toBe('Universidade Federal')
    expect(res.body.monthly_amount).toBe(400)
    expect(res.body.active).toBe(1)
    expect(res.body.id).toBeDefined()
  })

  it('passageiro não pode criar rota', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: 100 })
    expect(res.status).toBe(403)
  })

  it('usuário não autenticado não pode criar rota', async () => {
    const res = await request(app)
      .post('/api/routes')
      .send({ origin: 'A', destination: 'B', monthlyAmount: 100 })
    expect(res.status).toBe(401)
  })

  it('rota com preço zero é rejeitada', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('inválido')
  })

  it('rota com preço negativo é rejeitada', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: -100 })
    expect(res.status).toBe(400)
  })

  it('preço inválido (NaN) é rejeitado', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: NaN })
    expect(res.status).toBe(400)
  })

  it('preço inválido (Infinity) é rejeitado', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: Infinity })
    expect(res.status).toBe(400)
  })

  it('origin vazio é rejeitado', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: '', destination: 'B', monthlyAmount: 100 })
    expect(res.status).toBe(400)
  })

  it('destination vazio é rejeitado', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: '', monthlyAmount: 100 })
    expect(res.status).toBe(400)
  })

  it('whitespace é normalizado', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: '  Ipiranga  ', destination: '  IFPI  ', monthlyAmount: 450 })
    expect(res.status).toBe(201)
    expect(res.body.origin).toBe('Ipiranga')
    expect(res.body.destination).toBe('IFPI')
  })

  it('rota duplicada é rejeitada', async () => {
    await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: 100 })
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'A', destination: 'B', monthlyAmount: 200 })
    expect(res.status).toBe(409)
  })
})

describe('GET /api/routes', () => {
  it('admin lista todas as rotas', async () => {
    const db = getDb()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 100, 1)").run(uuid())
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 200, 0)").run(uuid())
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('passageiro lista somente rotas ativas', async () => {
    const db = getDb()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 100, 1)").run(uuid())
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 200, 0)").run(uuid())
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].origin).toBe('A')
  })

  it('admin com includeInactive=true lista todas', async () => {
    const db = getDb()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 100, 1)").run(uuid())
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 200, 0)").run(uuid())
    const res = await request(app).get('/api/routes?includeInactive=true').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

describe('GET /api/routes/:id', () => {
  it('retorna rota por id', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    const res = await request(app).get(`/api/routes/${id}`).set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.origin).toBe('A')
  })

  it('retorna 404 para rota inexistente', async () => {
    const res = await request(app).get(`/api/routes/${uuid()}`).set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/routes/:id', () => {
  it('admin atualiza rota', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    const res = await request(app)
      .put(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 500 })
    expect(res.status).toBe(200)
    expect(res.body.monthly_amount).toBe(500)
  })

  it('passageiro não pode atualizar rota', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    const res = await request(app)
      .put(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ monthlyAmount: 500 })
    expect(res.status).toBe(403)
  })

  it('desativação funciona', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    const res = await request(app)
      .put(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
    expect(res.status).toBe(200)
    expect(res.body.active).toBe(0)
  })

  it('rota desativada continua existindo no banco', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    await request(app)
      .put(`/api/routes/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(id)
    expect(route).toBeDefined()
  })
})

describe('DELETE /api/routes/:id', () => {
  it('soft delete (desativa) funciona', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    const res = await request(app).delete(`/api/routes/${id}`).set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
    const route = db.prepare('SELECT active FROM routes WHERE id = ?').get(id) as any
    expect(route.active).toBe(0)
  })

  it('rota desativada não aparece na listagem normal do passageiro', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    await request(app).delete(`/api/routes/${id}`).set('Authorization', `Bearer ${adminToken}`)
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.body).toHaveLength(0)
  })

  it('rota desativada continua existindo no banco', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 100)").run(id)
    await request(app).delete(`/api/routes/${id}`).set('Authorization', `Bearer ${adminToken}`)
    const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(id)
    expect(route).toBeDefined()
  })
})

describe('Snapshot protection', () => {
  it('atualização de preço NÃO modifica nenhuma monthly_fee existente', async () => {
    const db = getDb()
    const passengerId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
      .run(passengerId, 'Test', '222.222.222-22', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 9, 2026, 189.90, 5, '05/09/2026', 'pending')")
      .run(feeId, passengerId, 'Test', '222.222.222-22')

    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount) VALUES (?, 'A', 'B', 189.90)").run(routeId)

    await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 999.99 })

    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(189.90)
  })
})
