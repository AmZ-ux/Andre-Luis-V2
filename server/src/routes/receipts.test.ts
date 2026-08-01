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
import receiptsRoutes from '../routes/receipts.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/receipts', authMiddleware, receiptsRoutes)

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

let recPassCounter = 0

function seedPassenger(): string {
  const db = getDb()
  const id = uuid()
  recPassCounter++
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
    .run(id, 'Test Passenger', `111.111.111-${String(recPassCounter).padStart(2, '0')}`, '2000-01-01')
  return id
}

function seedMonthlyFee(passengerId: string): string {
  const db = getDb()
  const id = uuid()
  db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
    .run(id, passengerId, 'Test Passenger', '111.111.111-11', 'university', 7, 2026, 189.90, 5, '07/2026')
  return id
}

function seedReceipt(overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  const pid = overrides.passengerId ?? seedPassenger()
  const mfid = overrides.monthlyFeeId ?? seedMonthlyFee(pid)
  db.prepare(`
    INSERT INTO receipts (id, monthly_fee_id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, file_name, file_type, file_size, file_data, file_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, mfid, pid,
    overrides.passengerName ?? 'Test Passenger',
    overrides.cpf ?? '111.111.111-11',
    overrides.transportType ?? 'university',
    overrides.month ?? 7, overrides.year ?? 2026,
    overrides.amount ?? 189.90,
    overrides.fileName ?? 'receipt.pdf',
    overrides.fileType ?? 'application/pdf',
    overrides.fileSize ?? 1024,
    overrides.fileData ?? '',
    overrides.filePath ?? '',
    overrides.status ?? 'awaiting'
  )
  return id
}

describe('GET /api/receipts', () => {
  it('should return empty list when no receipts exist', async () => {
    const res = await request(app).get('/api/receipts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data')
    expect(res.body).toHaveProperty('total')
    expect(res.body.data).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('should return paginated receipts', async () => {
    seedReceipt()
    seedReceipt()
    const res = await request(app).get('/api/receipts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.total).toBe(2)
  })

  it('should filter by status', async () => {
    seedReceipt({ status: 'awaiting' })
    seedReceipt({ status: 'approved' })
    const res = await request(app).get('/api/receipts?status=approved').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].status).toBe('approved')
  })
})

describe('GET /api/receipts/summary', () => {
  it('should return summary counts by status', async () => {
    seedReceipt({ status: 'awaiting' })
    seedReceipt({ status: 'approved' })
    seedReceipt({ status: 'rejected' })
    const res = await request(app).get('/api/receipts/summary').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('awaiting')
    expect(res.body).toHaveProperty('approved')
    expect(res.body).toHaveProperty('rejected')
    expect(res.body).toHaveProperty('total')
    expect(res.body.awaiting).toBe(1)
    expect(res.body.approved).toBe(1)
    expect(res.body.rejected).toBe(1)
    expect(res.body.total).toBe(3)
  })

  it('should return all zeros when no receipts', async () => {
    const res = await request(app).get('/api/receipts/summary').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.awaiting).toBe(0)
    expect(res.body.approved).toBe(0)
    expect(res.body.rejected).toBe(0)
    expect(res.body.total).toBe(0)
  })
})

describe('GET /api/receipts/:id', () => {
  it('should return receipt with history', async () => {
    const rid = seedReceipt()
    const res = await request(app).get(`/api/receipts/${rid}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('receipt')
    expect(res.body).toHaveProperty('history')
    expect(res.body.receipt.id).toBe(rid)
  })

  it('should return 404 for non-existent receipt', async () => {
    const res = await request(app).get('/api/receipts/non-existent').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Comprovante não encontrado')
  })
})

describe('POST /api/receipts', () => {
  it('should return 400 when no file is sent', async () => {
    const pid = seedPassenger()
    const mfid = seedMonthlyFee(pid)
    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .field('monthlyFeeId', mfid)
      .field('passengerId', pid)
      .field('passengerName', 'Test Passenger')
      .field('cpf', '111.111.111-11')
      .field('transportType', 'university')
      .field('month', '7')
      .field('year', '2026')
      .field('amount', '189.90')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Arquivo não enviado')
  })

  it('should return 500 when file upload fails server-side', async () => {
    const pid = seedPassenger()
    const mfid = seedMonthlyFee(pid)
    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .field('monthlyFeeId', mfid)
      .field('passengerId', pid)
      .field('passengerName', 'Test Passenger')
      .field('cpf', '111.111.111-11')
      .field('transportType', 'university')
      .field('month', '7')
      .field('year', '2026')
      .field('amount', '189.90')
      .attach('file', Buffer.from('plain text content'), 'receipt.txt')
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/receipts/:id/approve', () => {
  it('should approve a receipt', async () => {
    const rid = seedReceipt()
    const res = await request(app)
      .put(`/api/receipts/${rid}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Aprovado' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
    expect(res.body.reviewed_by).toBe(adminId)
  })

  it('should return 404 when receipt not found', async () => {
    const res = await request(app)
      .put('/api/receipts/non-existent/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Ok' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Comprovante não encontrado')
  })
})

describe('PUT /api/receipts/:id/reject', () => {
  it('should reject a receipt', async () => {
    const rid = seedReceipt()
    const res = await request(app)
      .put(`/api/receipts/${rid}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Documento ilegível' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('rejected')
    expect(res.body.reviewed_by).toBe(adminId)
  })

  it('should return 404 when receipt not found', async () => {
    const res = await request(app)
      .put('/api/receipts/non-existent/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Inválido' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Comprovante não encontrado')
  })

  it('should create receipt history entry on reject', async () => {
    const rid = seedReceipt()
    await request(app)
      .put(`/api/receipts/${rid}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Duplicado' })
    const db = getDb()
    const history = db.prepare('SELECT * FROM receipt_history WHERE receipt_id = ?').all(rid)
    expect(history).toHaveLength(1)
    expect(history[0].action).toBe('rejected')
  })
})
