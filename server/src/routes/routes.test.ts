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
import passengersRoutes from '../routes/passengers.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/routes', authMiddleware, routesRoutes)
app.use('/api/passengers', authMiddleware, passengersRoutes)

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

  it('atualização de preço sincroniza passengers.monthly_fee dos passageiros vinculados', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'Sync', 'Test', 400, 1)").run(routeId)
    // Two passengers linked to this route
    const p1 = uuid()
    const p2 = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(p1, 'Sync1', '111.111.111-01', '2000-01-01', routeId)
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(p2, 'Sync2', '222.222.222-02', '2000-01-01', routeId)
    // Unlinked passenger — should NOT be affected
    const p3 = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 300)")
      .run(p3, 'Unlinked', '333.333.333-03', '2000-01-01')
    // Change route price
    await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 550 })
    // Linked passengers updated
    const updated1 = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(p1) as any
    const updated2 = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(p2) as any
    expect(updated1.monthly_fee).toBe(550)
    expect(updated2.monthly_fee).toBe(550)
    // Unlinked passenger unchanged
    const unlinked = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(p3) as any
    expect(unlinked.monthly_fee).toBe(300)
  })

  it('sync de preço é atômico (transactional)', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'Atom', 'Test', 400, 1)").run(routeId)
    const p1 = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(p1, 'Atom1', '444.444.444-04', '2000-01-01', routeId)
    await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 600 })
    const route = db.prepare('SELECT monthly_amount FROM routes WHERE id = ?').get(routeId) as any
    const passenger = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(p1) as any
    expect(route.monthly_amount).toBe(600)
    expect(passenger.monthly_fee).toBe(600)
  })

  it('não altera passageiros quando apenas origin/destination muda (sem monthlyAmount)', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'NoSync', 'Test', 400, 1)").run(routeId)
    const p1 = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(p1, 'NoSync1', '555.555.555-05', '2000-01-01', routeId)
    await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ origin: 'NewOrigin' })
    const passenger = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(p1) as any
    expect(passenger.monthly_fee).toBe(400) // unchanged
  })
})

describe('Route lifecycle — deactivation', () => {
  it('deactivate route preserves linked passenger.route_id', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    const p = db.prepare('SELECT route_id FROM passengers WHERE id = ?').get(pid) as any
    expect(p.route_id).toBe(routeId)
  })

  it('deactivate route preserves passenger.monthly_fee', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    const p = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(pid) as any
    expect(p.monthly_fee).toBe(400)
  })

  it('deactivate route preserves existing monthly_fees', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 400, 5, '05/08/2026', 'pending')")
      .run(feeId, pid, 'P', '111.111.111-01')
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    const fee = db.prepare('SELECT amount, status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(400)
    expect(fee.status).toBe('pending')
  })
})

describe('Route lifecycle — inactive route price sync blocked', () => {
  it('price change on inactive route is rejected (400)', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    // Deactivate
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    // Try to change price
    const res = await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 500 })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('rota inativa')
    // Passenger price unchanged
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    const p = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(pid) as any
    expect(p.monthly_fee).toBe(400)
  })

  it('active route price change still syncs passengers', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ monthlyAmount: 550 })
    expect(res.status).toBe(200)
    const p = db.prepare('SELECT monthly_fee FROM passengers WHERE id = ?').get(pid) as any
    expect(p.monthly_fee).toBe(550)
  })
})

describe('Route lifecycle — reactivation', () => {
  it('reactivate route makes it available for new association', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    // Deactivate
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    // Reactivate
    const res = await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: true })
    expect(res.status).toBe(200)
    expect(res.body.active).toBe(1)
    // Can now associate new passenger
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day, phone, email) VALUES (?, ?, ?, ?, 'university', 'active', 300, 5, '', '')")
      .run(pid, 'New', '222.222.222-02', '2000-01-01')
    const upd = await request(app)
      .put(`/api/passengers/${pid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ route_id: routeId })
    expect(upd.status).toBe(200)
    expect(upd.body.route_id).toBe(routeId)
    expect(upd.body.monthly_fee).toBe(400)
  })

  it('reactivated route: historical monthly_fees unchanged', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 400, 5, '05/08/2026', 'paid')")
      .run(feeId, pid, 'P', '111.111.111-01')
    // Deactivate + reactivate
    await request(app).delete(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`)
    await request(app).put(`/api/routes/${routeId}`).set('Authorization', `Bearer ${adminToken}`).send({ active: true })
    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(400)
  })
})

describe('Fee generator with inactive route', () => {
  it('generator creates fee for passenger on inactive route using passenger.monthly_fee', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id, contract_start_date) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?, '2026-01-01')")
      .run(pid, 'P', '111.111.111-01', '2000-01-01', routeId)
    // Deactivate route
    db.prepare('UPDATE routes SET active = 0 WHERE id = ?').run(routeId)
    // Import and run generator
    const { generateMonthlyFees } = await import('../services/monthlyFeeGenerator.js')
    const result = generateMonthlyFees({ month: 10, year: 2026, passengerIds: [pid] }, db)
    expect(result.created).toBe(1)
    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 10 AND year = 2026').get(pid) as any
    expect(fee.amount).toBe(400) // uses passenger.monthly_fee, not route.monthly_amount
  })

  it('generator does NOT check route.active', async () => {
    const db = getDb()
    const routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 500, 0)").run(routeId)
    const pid = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id, contract_start_date) VALUES (?, ?, ?, ?, 'university', 'active', 500, ?, '2026-01-01')")
      .run(pid, 'P2', '222.222.222-02', '2000-01-01', routeId)
    const { generateMonthlyFees } = await import('../services/monthlyFeeGenerator.js')
    const result = generateMonthlyFees({ month: 10, year: 2026, passengerIds: [pid] }, db)
    expect(result.created).toBe(1)
  })
})
