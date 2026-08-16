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
import { errorHandler } from '../middleware/errorHandler.js'
import dashboardRoutes from '../routes/dashboard.js'
import passengerRoutes from '../routes/passengers.js'
import communicationRoutes from '../routes/communication.js'
import settingsRoutes from '../routes/settings.js'
import availabilityRoutes from '../routes/availability.js'
import monthlyFeeRoutes from '../routes/monthlyFees.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/dashboard', authMiddleware, dashboardRoutes)
app.use('/api/passengers', authMiddleware, passengerRoutes)
app.use('/api/communication', authMiddleware, communicationRoutes)
app.use('/api/settings', authMiddleware, settingsRoutes)
app.use('/api/availabilities', authMiddleware, availabilityRoutes)
app.use('/api/monthly-fees', authMiddleware, monthlyFeeRoutes)
app.use(errorHandler)

let passengerToken: string
let passengerId: string
let adminToken: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  passengerId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
    .run(passengerId, 'Passageiro', 'pass@teste.com', '111.111.111-11', '', bcrypt.hashSync('password', 10))
  passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')

  const adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@teste.com', '000.000.000-00', '', bcrypt.hashSync('password', 10))
  adminToken = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')
})

describe('Autorização — passageiro não acessa áreas administrativas', () => {
  it('dashboard bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('dashboard permite admin (200)', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('passageiros: listagem bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/passengers').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('passageiros: criação bloqueia passageiro (403)', async () => {
    const res = await request(app).post('/api/passengers').set('Authorization', `Bearer ${passengerToken}`).send({})
    expect(res.status).toBe(403)
  })

  it('passageiros: listagem permite admin (200)', async () => {
    const res = await request(app).get('/api/passengers').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('settings: escrita bloqueia passageiro (403)', async () => {
    const res = await request(app).put('/api/settings/financial').set('Authorization', `Bearer ${passengerToken}`).send({})
    expect(res.status).toBe(403)
  })

  it('settings: listagem de usuários bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/settings/users').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('settings: escrita permite admin (200)', async () => {
    const res = await request(app).put('/api/settings/financial').set('Authorization', `Bearer ${adminToken}`).send({ defaultDueDay: 5 })
    expect(res.status).toBe(200)
  })

  it('communication: envio de mensagem bloqueia passageiro (403)', async () => {
    const res = await request(app).post('/api/communication').set('Authorization', `Bearer ${passengerToken}`).send({ title: 'x', body: 'y' })
    expect(res.status).toBe(403)
  })

  it('communication: whatsapp send bloqueia passageiro (403)', async () => {
    const res = await request(app).post('/api/communication/whatsapp/send').set('Authorization', `Bearer ${passengerToken}`).send({ to: '5588999999999', message: 'oi' })
    expect(res.status).toBe(403)
  })

  it('communication: push send-all bloqueia passageiro (403)', async () => {
    const res = await request(app).post('/api/communication/push/send-all').set('Authorization', `Bearer ${passengerToken}`).send({ title: 'x', body: 'y' })
    expect(res.status).toBe(403)
  })

  it('availabilities: listagem geral bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/availabilities').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('availabilities: summary bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/availabilities/summary').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('monthly-fees: listagem geral bloqueia passageiro (403)', async () => {
    const res = await request(app).get('/api/monthly-fees').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('availabilities: passageiro cria férias só para si (passenger_id forçado)', async () => {
    const db = getDb()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(passengerId, 'Passageiro', '111.111.111-11', '2000-01-01')

    const otherId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(otherId, 'Outro', '222.222.222-22', '2000-01-01')

    const res = await request(app)
      .post('/api/availabilities')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ passengerId: otherId, passengerName: 'Outro', cpf: '222.222.222-22', startDate: '01/09/2026', endDate: '15/09/2026' })
    expect(res.status).toBe(201)
    expect(res.body.passenger_id).toBe(passengerId)

    const otherAv = db.prepare('SELECT id FROM availabilities WHERE passenger_id = ?').get(otherId)
    expect(otherAv).toBeUndefined()
  })

  it('availabilities: passageiro não cancela férias de outro (403)', async () => {
    const db = getDb()
    const otherId = uuid()
    const avId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(otherId, 'Outro', '222.222.222-22', '2000-01-01')
    db.prepare(`
      INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'university', 'vacation', '01/07/2026', '15/07/2026', 'scheduled')
    `).run(avId, otherId, 'Outro', '222.222.222-22')

    const res = await request(app)
      .put(`/api/availabilities/${avId}/cancel`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ reason: 'x' })
    expect(res.status).toBe(403)
  })

  it('monthly-fees: passageiro não vê detalhe de mensalidade de outro (403)', async () => {
    const db = getDb()
    const otherId = uuid()
    const feeId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(otherId, 'Outro', '222.222.222-22', '2000-01-01')
    db.prepare(`
      INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
      VALUES (?, ?, ?, ?, 'university', 8, 2026, 200, 5, '05/08/2026', 'pending')
    `).run(feeId, otherId, 'Outro', '222.222.222-22')

    const res = await request(app).get(`/api/monthly-fees/${feeId}`).set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('availabilities: passageiro só vê as próprias férias em /active (sem CPF de outros)', async () => {
    const db = getDb()
    const otherId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(otherId, 'Outro', '222.222.222-22', '2000-01-01')
    db.prepare(`
      INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'university', 'vacation', '01/07/2026', '15/07/2026', 'scheduled')
    `).run(uuid(), otherId, 'Outro', '222.222.222-22')
    db.prepare(`
      INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, status)
      VALUES (?, ?, ?, ?, 'university', 'vacation', '01/08/2026', '15/08/2026', 'scheduled')
    `).run(uuid(), passengerId, 'Passageiro', '111.111.111-11')

    const res = await request(app).get('/api/availabilities/active').set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].passenger_id).toBe(passengerId)
  })
})
