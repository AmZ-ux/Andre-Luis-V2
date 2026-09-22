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
      .send({ name: 'Updated Name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.monthly_fee).toBe(100)
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

  it('should accept status "active"', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'inactive')")
      .run(id, 'SetActive', '100.100.100-01', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('active')
  })

  it('should accept status "inactive"', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'SetInactive', '100.100.100-02', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('inactive')
  })

  it('should accept status "vacation"', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'SetVacation', '100.100.100-03', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'vacation' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('vacation')
  })

  it('should accept status "blocked"', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'SetBlocked', '100.100.100-04', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'blocked' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('blocked')
  })

  it('should reject unknown status with 400', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'RejectUnknown', '100.100.100-05', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'unknown_value' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')
  })

  it('should reject status "paid" with 400', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'RejectPaid', '100.100.100-06', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paid' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')
  })

  it('should reject empty string status with 400', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'RejectEmpty', '100.100.100-07', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Status inválido')
  })

  it('should not alter previous status when invalid status is rejected', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'vacation')")
      .run(id, 'PreserveStatus', '100.100.100-08', '2000-01-01')
    await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid_status' })
    const row = db.prepare('SELECT status FROM passengers WHERE id = ?').get(id) as any
    expect(row.status).toBe('vacation')
  })

  it('should allow updating other fields without status', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'OtherField', '100.100.100-09', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', phone: '(11) 99999-9999' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    expect(res.body.phone).toBe('(11) 99999-9999')
    expect(res.body.status).toBe('active')
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

  it('should cascade delete related data when superAdmin deletes passenger WITHOUT financial history', async () => {
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
    // No payments, no pix_charges - no financial history

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

  it('should block cascade delete when superAdmin deletes passenger WITH financial history (payment)', async () => {
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

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('histórico financeiro')

    // Everything preserved
    expect(db.prepare('SELECT id FROM monthly_fees WHERE id = ?').get(feeId)).toBeDefined()
    expect(db.prepare('SELECT id FROM payments WHERE monthly_fee_id = ?').get(feeId)).toBeDefined()
    expect(db.prepare('SELECT id FROM pix_charges WHERE monthly_fee_id = ?').get(feeId)).toBeDefined()
    expect(db.prepare('SELECT id FROM availabilities WHERE id = ?').get(avId)).toBeDefined()
    expect(db.prepare('SELECT id FROM availability_history WHERE availability_id = ?').get(avId)).toBeDefined()
    expect(db.prepare('SELECT id FROM notifications WHERE user_id = ?').get(id)).toBeDefined()
    expect(db.prepare('SELECT id FROM users WHERE id = ?').get(id)).toBeDefined()
    expect(db.prepare('SELECT id FROM passengers WHERE id = ?').get(id)).toBeDefined()
  })

  it('passenger with paid monthly_fee → DELETE 409, all preserved', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super@test.com', '111.111.111-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'PaidFee', '222.222.222-00', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'PaidFee', 'paidfee@test.com', '222.222.222-00')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'paid')")
      .run(feeId, id, 'PaidFee', '222.222.222-00')

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)
    expect(res.body.error).toContain('histórico financeiro')

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
    expect(db.prepare('SELECT * FROM users WHERE id = ?').get(id)).toBeDefined()
    expect(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)).toBeDefined()
    expect(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)?.status).toBe('paid')
  })

  it('passenger with pending fee + SUBPAYMENT → DELETE 409, all preserved', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super2@test.com', '333.333.333-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'SubPay', '444.444.444-00', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'SubPay', 'subpay@test.com', '444.444.444-00')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'pending')")
      .run(feeId, id, 'SubPay', '444.444.444-00')
    db.prepare("INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, entry_type) VALUES (?, ?, 200, '05/07/2026', 'pix', 'SUBPAYMENT')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)
    expect(fee).toBeDefined()
    expect(fee?.status).toBe('pending')
    const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(feeId)
    expect(payment).toBeDefined()
    expect(payment?.entry_type).toBe('SUBPAYMENT')
  })

  it('passenger with pending fee + NORMAL payment → DELETE 409, all preserved', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super3@test.com', '555.555.555-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'NormPay', '666.666.666-00', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'NormPay', 'normpay@test.com', '666.666.666-00')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'pending')")
      .run(feeId, id, 'NormPay', '666.666.666-00')
    db.prepare("INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, entry_type) VALUES (?, ?, 400, '05/07/2026', 'pix', 'NORMAL')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)
    expect(fee).toBeDefined()
    expect(fee?.status).toBe('pending')
  })

  it('passenger with OVERPAYMENT → DELETE 409, all preserved', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super4@test.com', '777.777.777-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'OverPay', '888.888.888-00', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'OverPay', 'overpay@test.com', '888.888.888-00')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'paid')")
      .run(feeId, id, 'OverPay', '888.888.888-00')
    db.prepare("INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, entry_type) VALUES (?, ?, 500, '05/07/2026', 'pix', 'OVERPAYMENT')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
    const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(feeId)
    expect(payment).toBeDefined()
    expect(payment?.entry_type).toBe('OVERPAYMENT')
  })

  it('passenger with succeeded pix_charge → DELETE 409, all preserved', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super5@test.com', '999.999.999-00', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'PixSucc', '111.111.111-11', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'PixSucc', 'pixsucc@test.com', '111.111.111-11')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'pending')")
      .run(feeId, id, 'PixSucc', '111.111.111-11')
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'pi_test', ?, 400, 'succeeded')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
    const pix = db.prepare('SELECT * FROM pix_charges WHERE monthly_fee_id = ?').get(feeId)
    expect(pix).toBeDefined()
    expect(pix?.status).toBe('succeeded')
  })

  it('passenger with succeeded_underpaid pix_charge → DELETE 409', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super6@test.com', '222.222.222-11', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'PixUnder', '333.333.333-11', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'PixUnder', 'pixunder@test.com', '333.333.333-11')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'pending')")
      .run(feeId, id, 'PixUnder', '333.333.333-11')
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'pi_test', ?, 200, 'succeeded_underpaid')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    const pix = db.prepare('SELECT * FROM pix_charges WHERE monthly_fee_id = ?').get(feeId)
    expect(pix?.status).toBe('succeeded_underpaid')
  })

  it('passenger with succeeded_overpaid pix_charge → DELETE 409', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super7@test.com', '444.444.444-11', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'PixOver', '555.555.555-11', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'PixOver', 'pixover@test.com', '555.555.555-11')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'paid')")
      .run(feeId, id, 'PixOver', '555.555.555-11')
    db.prepare("INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status) VALUES (?, 'pi_test', ?, 500, 'succeeded_overpaid')")
      .run(uuid(), feeId)

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(409)

    const pix = db.prepare('SELECT * FROM pix_charges WHERE monthly_fee_id = ?').get(feeId)
    expect(pix?.status).toBe('succeeded_overpaid')
  })

  it('passenger with ONLY pending fee (no payment, no pix) → DELETE allowed (200)', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super8@test.com', '666.666.666-11', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'NoHistory', '777.777.777-11', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'NoHistory', 'nohist@test.com', '777.777.777-11')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 7, 2026, 400, 5, '07/2026', 'pending')")
      .run(feeId, id, 'NoHistory', '777.777.777-11')

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeUndefined()
    expect(db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)).toBeUndefined()
  })

  it('passenger with NO fees at all → DELETE allowed (200)', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super9@test.com', '888.888.888-11', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Empty', '999.999.999-11', '2000-01-01')
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, '', 'passenger', 'x')")
      .run(id, 'Empty', 'empty@test.com', '999.999.999-11')

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(200)

    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeUndefined()
    expect(db.prepare('SELECT * FROM users WHERE id = ?').get(id)).toBeUndefined()
  })

  it('non-existent passenger ID → 404', async () => {
    const db = getDb()
    const superAdminId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash, super_admin) VALUES (?, ?, ?, ?, ?, 'admin', ?, 1)")
      .run(superAdminId, 'Super', 'super10@test.com', '111.111.111-11', '', bcrypt.hashSync('password', 10))
    const superAdminToken = jwt.sign({ userId: superAdminId, role: 'admin' }, 'dev-secret-change-in-production')

    const res = await request(app).delete(`/api/passengers/${uuid()}`).set('Authorization', `Bearer ${superAdminToken}`)
    expect(res.status).toBe(404)
  })

  it('regular admin (not superAdmin) → 403 even for passenger without history', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Test', '222.222.222-22', '2000-01-01')

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toBe('Apenas o super administrador')
    expect(db.prepare('SELECT * FROM passengers WHERE id = ?').get(id)).toBeDefined()
  })

  it('passenger role → 403', async () => {
    const db = getDb()
    const passengerId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passengerId, 'Pass', 'pass@test.com', '333.333.333-22', '', bcrypt.hashSync('password', 10))
    const passengerToken = jwt.sign({ userId: passengerId, role: 'passenger' }, 'dev-secret-change-in-production')

    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
      .run(id, 'Target', '444.444.444-22', '2000-01-01')

    const res = await request(app).delete(`/api/passengers/${id}`).set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('unauthorized → 401', async () => {
    const res = await request(app).delete('/api/passengers/some-id')
    expect(res.status).toBe(401)
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

describe('Passenger route_id (Phase 2C.1)', () => {
  let routeId: string
  let inactiveRouteId: string

  beforeEach(() => {
    const db = getDb()
    routeId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'Origem', 'Destino', 400, 1)")
      .run(routeId)
    inactiveRouteId = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'Inativa', 'Destino', 300, 0)")
      .run(inactiveRouteId)
  })

  it('existing passenger with route_id NULL remains valid', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'NoRoute', '111.111.111-01', '2000-01-01')
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBeNull()
    expect(res.body.monthly_fee).toBe(400)
  })

  it('create without routeId continues working (POST blocked, but registration works)', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 200)")
      .run(id, 'NoRouteCreate', '222.222.222-02', '2000-01-01')
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBeNull()
  })

  it('create with valid routeId works via PUT', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'WithRoute', '333.333.333-03', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId })
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(routeId)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('create with non-existent routeId is rejected', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'BadRoute', '444.444.444-04', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: 'non-existent-id' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Rota não encontrada')
  })

  it('create with inactive routeId is rejected', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'InactiveRoute', '555.555.555-05', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: inactiveRouteId })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('rota inativa')
  })

  it('update with valid routeId works', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'UpdateRoute', '666.666.666-06', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, name: 'UpdateRoute' })
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(routeId)
  })

  it('update to non-existent routeId is rejected', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'BadUpdate', '777.777.777-07', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: 'does-not-exist' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Rota não encontrada')
  })

  it('update to inactive routeId is rejected for new association', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'InactiveUpdate', '888.888.888-08', '2000-01-01')
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: inactiveRouteId })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('rota inativa')
  })

  it('remove route association (set to null)', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'RemoveRoute', '999.999.999-09', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: null })
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBeNull()
  })

  it('deactivating a route does NOT invalidate linked passenger', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'LinkedPassenger', '100.100.100-10', '2000-01-01', routeId)
    // Deactivate the route
    await request(app)
      .put(`/api/routes/${routeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false }).catch(() => {})
    // Use the routes API directly
    const db2 = getDb()
    db2.prepare('UPDATE routes SET active = 0 WHERE id = ?').run(routeId)
    // Passenger should still be valid
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(routeId)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('routeId appears correctly in response', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'RouteResponse', '101.101.101-11', '2000-01-01', routeId)
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(routeId)
  })

  it('routeId null is handled correctly in response', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'NullRoute', '102.102.102-12', '2000-01-01')
    const res = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBeNull()
  })

  it('changing routeId now DERIVES monthly_fee from the new route', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'FeePreserved', '103.103.103-13', '2000-01-01')
    // Create a second route with monthly_amount=500
    const route2Id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'O2', 'D2', 500, 1)")
      .run(route2Id)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: route2Id })
    expect(res.status).toBe(200)
    expect(res.body.monthly_fee).toBe(500) // derived from new route
    expect(res.body.route_id).toBe(route2Id)
  })

  it('changing routeId does NOT change monthly_fees.amount', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
      .run(id, 'FeeAmount', '104.104.104-14', '2000-01-01')
    const feeId = uuid()
    db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 400, 5, '08/2026', 'pending')")
      .run(feeId, id, 'FeeAmount', '104.104.104-14')
    // Create a second route
    const route2Id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'O2', 'D2', 500, 1)")
      .run(route2Id)
    // Change route
    await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: route2Id })
    // Fee amount should be unchanged
    const fee = db.prepare('SELECT amount FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.amount).toBe(400)
  })

  it('legacy passengers without routeId remain listable', async () => {
    const db = getDb()
    for (let i = 0; i < 3; i++) {
      const id = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 200)")
        .run(id, `Legacy ${i}`, `200.200.200-${String(i).padStart(2, '0')}`, '2000-01-01')
    }
    const res = await request(app).get('/api/passengers').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(3)
    // None should have route_id set
    const legacy = res.body.data.filter((p: any) => p.name.startsWith('Legacy'))
    expect(legacy.every((p: any) => p.route_id === null || p.route_id === undefined)).toBe(true)
  })

  it('dashboard/queries continue functioning (passenger data intact)', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'DashTest', '300.300.300-15', '2000-01-01', routeId)
    // Passenger can be found and queried
    const getRes = await request(app).get(`/api/passengers/${id}`).set('Authorization', `Bearer ${token}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.route_id).toBe(routeId)
    expect(getRes.body.monthly_fee).toBe(400)
    // List still works
    const listRes = await request(app).get('/api/passengers').set('Authorization', `Bearer ${token}`)
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.some((p: any) => p.id === id)).toBe(true)
  })

  it('permissions remain intact for passenger operations', async () => {
    const db = getDb()
    const passId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
      .run(passId, 'Pass', 'pass-perm@test.com', '400.400.400-16', '', bcrypt.hashSync('password', 10))
    const passToken = jwt.sign({ userId: passId, role: 'passenger' }, 'dev-secret-change-in-production')
    const targetId = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(targetId, 'PermTest', '500.500.500-17', '2000-01-01', routeId)
    // Passenger cannot update route_id
    const res = await request(app)
      .put(`/api/passengers/${targetId}`)
      .set('Authorization', `Bearer ${passToken}`)
      .send({ route_id: 'hack' })
    expect(res.status).toBe(403)
  })

  it('TAMPER: sending monthly_fee=1 with valid route_id derives price from route, ignores tampered fee', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'TamperTest', '600.600.600-18', '2000-01-01', routeId)
    // Client sends route_id (valid) + monthly_fee (tampered to 1)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: 1 })
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(routeId)
    // monthly_fee is derived from route.monthly_amount (400), NOT from tampered value (1)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('PRICE_AUTHORITY: backend derives monthly_fee from route, ignores client monthly_fee', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'PriceAuth', '700.700.700-19', '2000-01-01', routeId)
    // Send monthly_fee that does NOT match route's monthly_amount (400)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: 9999 })
    expect(res.status).toBe(200)
    // Backend derives from route, ignores client value
    expect(res.body.monthly_fee).toBe(400)
  })

  it('TAMPER_HIGH: sending monthly_fee=999999 with valid route_id is ignored', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'TamperHigh', '700.700.700-20', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: 999999 })
    expect(res.status).toBe(200)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('TAMPER_NEGATIVE: sending monthly_fee=-1 with valid route_id is ignored', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'TamperNeg', '700.700.700-21', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: -1 })
    expect(res.status).toBe(200)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('TAMPER_STRING: sending monthly_fee="NaN" with valid route_id is ignored', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'TamperStr', '700.700.700-22', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: 'NaN' })
    expect(res.status).toBe(200)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('TAMPER_NULL: sending monthly_fee=null with valid route_id is ignored', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'TamperNull', '700.700.700-23', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: routeId, monthly_fee: null })
    expect(res.status).toBe(200)
    expect(res.body.monthly_fee).toBe(400)
  })

  it('UPDATE_OTHER_FIELD: sending monthly_fee=1 without route_id change does NOT alter price', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'OtherField', '700.700.700-24', '2000-01-01', routeId)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', monthly_fee: 1 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated Name')
    // monthly_fee unchanged — client cannot set it directly
    expect(res.body.monthly_fee).toBe(400)
  })

  it('ROUTE_CHANGE: changing route derives new price from new route', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
      .run(id, 'RouteChange', '700.700.700-25', '2000-01-01', routeId)
    // Create a second route with different price
    const route2Id = uuid()
    db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'O2', 'D2', 550, 1)")
      .run(route2Id)
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ route_id: route2Id, monthly_fee: 1 })
    expect(res.status).toBe(200)
    expect(res.body.route_id).toBe(route2Id)
    // Price derived from new route (550), not tampered (1)
    expect(res.body.monthly_fee).toBe(550)
  })

  it('LEGACY_NO_ROUTE: monthly_fee is not accepted from client for legacy passengers', async () => {
    const db = getDb()
    const id = uuid()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 200)")
      .run(id, 'LegacyFee', '700.700.700-26', '2000-01-01')
    // monthly_fee is no longer in the fields array — sending it has no effect
    const res = await request(app)
      .put(`/api/passengers/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated', monthly_fee: 999 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated')
    // monthly_fee unchanged — field is no longer accepted from client
    expect(res.body.monthly_fee).toBe(200)
  })
})
