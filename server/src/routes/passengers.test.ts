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
  it('should block admin passenger creation (registration is self-service)', async () => {
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
        monthlyFee: 189.9,
        dueDay: 5,
      })
    expect(res.status).toBe(403)
    const db = getDb()
    const passenger = db.prepare('SELECT id FROM passengers WHERE cpf = ?').get('444.444.444-44')
    expect(passenger).toBeUndefined()
    const user = db.prepare('SELECT id FROM users WHERE cpf = ?').get('444.444.444-44')
    expect(user).toBeUndefined()
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
  it('should delete a passenger (superAdmin)', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super Admin', 'super@test.com', '111.111.111-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'To Delete', '888.888.888-88', '2000-01-01')
    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const deleted = db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)
    expect(deleted).toBeUndefined()
  })

  it('should return 401 without token', async () => {
    const res = await request(app).delete('/api/passengers/any-id')
    expect(res.status).toBe(401)
  })

  it('should return 403 for passenger', async () => {
    const db = getDb()
    const passengerId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passengerId, 'Passenger', 'pass@test.com', '222.222.222-00', '', bcrypt.hashSync('password', 10))
    const passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')

    const targetId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(targetId, 'Target', '333.333.333-00', '2000-01-01')
    const res = await request(app).delete(`/api/passengers/${targetId}`).set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(targetId)).toBeDefined()
  })

  it('should return 403 for regular admin (not superAdmin)', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Protected', '444.444.444-00', '2000-01-01')
    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Apenas o super administrador')
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(id)).toBeDefined()
  })

  it('should keep passenger existing after regular admin delete attempt', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Still Here', '555.555.555-00', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'Still Here', 'still@test.com', '555.555.555-00')
    await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(id)).toBeDefined()
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(id)).toBeDefined()
  })

  it('should cascade delete related data when superAdmin deletes', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super Admin', 'super-cascade@test.com', '666.666.666-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Cascade', '999.888.777-66', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'Cascade', 'cascade@teste.com', '999.888.777-66')

    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 189.90, 5, '07/2026', 'pending')")
      .run(feeId, id, 'Cascade', '999.888.777-66')
    db.prepare("INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method) VALUES (?, ?, ?, ?, 'pix')")
      .run(uuid(), feeId, 189.90, '05/07/2026')
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'mp-1', ?, 189.90, 'pending')")
      .run(uuid(), feeId)

    const avId = uuid()
    db.prepare("INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, status) VALUES (?, ?, ?, ?, 'university', 'vacation', '2026-08-01', '2026-08-15', 'scheduled')")
      .run(avId, id, 'Cascade', '999.888.777-66')
    db.prepare("INSERT INTO availability_history (id, availability_id, action, performed_by, performed_by_id) VALUES (?, ?, 'created', 'admin', 'admin')")
      .run(uuid(), avId)
    db.prepare("INSERT INTO notifications (id, user_id, title, message) VALUES (?, ?, 'T', 'M')").run(uuid(), id)

    await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)

    expect(db.prepare('SELECT id FROM monthly_fees WHERE id = ?').get(feeId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM payments WHERE monthly_fee_id = ?').get(feeId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM pix_charges WHERE monthly_fee_id = ?').get(feeId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM availabilities WHERE id = ?').get(avId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM availability_history WHERE availability_id = ?').get(avId)).toBeUndefined()
    expect(db.prepare('SELECT id FROM notifications WHERE user_id = ?').get(id)).toBeUndefined()
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(id)).toBeUndefined()
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(id)).toBeUndefined()
  })

  it('should not regress other admin operations on passengers', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(id, 'Operational', '777.777.777-00', '2000-01-01')

    const listRes = await request(app).get('/api/passengers').set('Authorization', `Bearer ${token}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1)

    const getRes = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(getRes.status).toBe(200)

    const putRes = await request(app).put(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'Updated' })
    expect(putRes.status).toBe(200)
    expect(putRes.body.name).toBe('Updated')
  })
})

describe('GET /api/passengers/me (self-service)', () => {
  let passengerToken: string
  let passengerId: string
  let otherPassengerId: string

  beforeEach(() => {
    const db = getDb()
    passengerId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passengerId, 'Carlos Pereira', 'carlos@teste.com', '123.123.123-00', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, pickup_point, destination, notes) VALUES (?, 'Carlos Pereira', '123.123.123-00', '2000-01-01', 'university', 'active', 'Centro', 'UFSC', 'observacao interna')")
      .run(passengerId)
    passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')

    otherPassengerId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(otherPassengerId, 'Other Passenger', 'other@test.com', '999.999.999-99', '', bcrypt.hashSync('password', 10))
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, 'Other Passenger', '999.999.999-99', '2000-01-01', 'school', 'active')")
      .run(otherPassengerId)
  })

  it('returns own data for authenticated passenger (200)', async () => {
    const res = await request(app)
      .get('/api/passengers/me')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(passengerId)
    expect(res.body.name).toBe('Carlos Pereira')
    expect(res.body.cpf).toBe('123.123.123-00')
    expect(res.body.pickup_point).toBe('Centro')
  })

  it('does not expose internal notes or updated_at', async () => {
    const res = await request(app)
      .get('/api/passengers/me')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.notes).toBeUndefined()
    expect(res.body.updated_at).toBeUndefined()
  })

  it('blocks passenger from accessing third-party passenger by id (403)', async () => {
    const res = await request(app)
      .get(`/api/passengers/${otherPassengerId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('blocks passenger from listing passengers (403)', async () => {
    const res = await request(app)
      .get('/api/passengers')
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('blocks passenger from updating (403)', async () => {
    const res = await request(app)
      .put(`/api/passengers/${otherPassengerId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ name: 'Hacked' })
    expect(res.status).toBe(403)
  })

  it('blocks passenger from deleting (403)', async () => {
    const res = await request(app)
      .delete(`/api/passengers/${otherPassengerId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
    const db = getDb()
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(otherPassengerId)).toBeDefined()
  })

  it('keeps admin access to GET /:id (200)', async () => {
    const res = await request(app)
      .get(`/api/passengers/${passengerId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Carlos Pereira')
  })

  it('requires authentication on /me (401)', async () => {
    const res = await request(app).get('/api/passengers/me')
    expect(res.status).toBe(401)
  })

  it('returns 404 when authenticated user has no passenger record', async () => {
    const db = getDb()
    const orphanId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, 'Orfan', 'orfan@teste.com', '888.888.888-88', '', 'passenger', 'x')")
      .run(orphanId)
    const orphanToken = jwt.sign({ userId: orphanId, role: 'passenger' }, 'dev-secret-change-in-production')
    const res = await request(app)
      .get('/api/passengers/me')
      .set('Authorization', `Bearer ${orphanToken}`)
    expect(res.status).toBe(404)
  })
})
