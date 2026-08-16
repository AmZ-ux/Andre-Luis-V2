import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb, getDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'

process.env.DATABASE_PATH = ':memory:'
process.env.UPLOADS_DIR = path.join(os.tmpdir(), `receipts-test-${Date.now()}`)

const { default: receiptsRouter } = await import('../routes/receipts.js')
const { UPLOADS_DIR } = await import('../middleware/upload.js')

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/receipts', authMiddleware, receiptsRouter)

let adminToken: string
let passengerToken: string
let adminId: string

beforeAll(async () => {
  await runMigrations()
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', '', 'x')
  adminToken = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')
  const passId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'passenger', ?)")
    .run(passId, 'Pass', 'pass@test.com', '000.000.000-01', '', 'x')
  passengerToken = jwt.sign({ userId: passId, role: 'passenger' }, 'dev-secret-change-in-production')
})

afterAll(() => {
  fs.rmSync(UPLOADS_DIR, { recursive: true, force: true })
})

function seedPayment(receipt = ''): { paymentId: string; feeId: string } {
  const db = getDb()
  const passId = uuid()
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, '2000-01-01', 'university', 'active', 100, 5)")
    .run(passId, 'Passageiro', '111.111.111-11')
  const feeId = uuid()
  db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, 'university', 8, 2026, 100, 5, '05/08/2026', 'paid')")
    .run(feeId, passId, 'Passageiro', '111.111.111-11')
  const paymentId = uuid()
  db.prepare("INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, receipt, receipt_status) VALUES (?, ?, 100, '2026-08-10', 'pix', ?, ?)")
    .run(paymentId, feeId, receipt, receipt ? 'pending' : 'none')
  return { paymentId, feeId }
}

describe('POST /api/receipts (upload)', () => {
  it('should upload an image and return a protected url', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('fake-image-bytes'), { filename: 'comprovante.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(/^\/receipts\/[a-f0-9-]+\.png$/)
    expect(fs.existsSync(path.join(UPLOADS_DIR, res.body.filename))).toBe(true)
  })

  it('should reject unsupported file types', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('evil'), { filename: 'malware.exe', contentType: 'application/x-msdownload' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('should require authentication', async () => {
    const res = await request(app)
      .post('/api/receipts')
      .attach('file', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/receipts/:filename', () => {
  it('should serve an uploaded file with the correct content type', async () => {
    const up = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('fake-pdf'), { filename: 'doc.pdf', contentType: 'application/pdf' })
    const res = await request(app)
      .get(`/api/receipts/${up.body.filename}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
  })

  it('should reject path traversal filenames', async () => {
    const res = await request(app)
      .get('/api/receipts/..%2F..%2Fdatabase.sqlite')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('should return 404 for missing files', async () => {
    const res = await request(app)
      .get('/api/receipts/00000000-0000-0000-0000-000000000000.png')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('should require authentication', async () => {
    const res = await request(app).get('/api/receipts/00000000-0000-0000-0000-000000000000.png')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/receipts/:paymentId/approve|reject', () => {
  it('should approve a receipt as admin', async () => {
    const { paymentId } = seedPayment('/receipts/abc.png')
    const res = await request(app)
      .post(`/api/receipts/${paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, receiptStatus: 'approved' })
    const row = getDb().prepare('SELECT receipt_status FROM payments WHERE id = ?').get(paymentId) as any
    expect(row.receipt_status).toBe('approved')
  })

  it('should reject a receipt as admin', async () => {
    const { paymentId } = seedPayment('/receipts/abc.png')
    const res = await request(app)
      .post(`/api/receipts/${paymentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.receiptStatus).toBe('rejected')
  })

  it('should deny passengers', async () => {
    const { paymentId } = seedPayment('/receipts/abc.png')
    const res = await request(app)
      .post(`/api/receipts/${paymentId}/approve`)
      .set('Authorization', `Bearer ${passengerToken}`)
    expect(res.status).toBe(403)
  })

  it('should fail when payment has no receipt', async () => {
    const { paymentId } = seedPayment()
    const res = await request(app)
      .post(`/api/receipts/${paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('should return 404 for unknown payment', async () => {
    const res = await request(app)
      .post(`/api/receipts/${uuid()}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('should log the audit entry', async () => {
    const { paymentId } = seedPayment('/receipts/abc.png')
    await request(app)
      .post(`/api/receipts/${paymentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    const logs = getDb().prepare("SELECT COUNT(*) c FROM app_logs WHERE action = 'receipt'").get() as any
    expect(logs.c).toBe(1)
  })
})