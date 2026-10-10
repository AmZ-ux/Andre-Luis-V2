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
import communicationRoutes from '../routes/communication.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/communication', authMiddleware, communicationRoutes)

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

// scheduledAt mantém a mensagem em 'scheduled' (sem dispatch), permitindo
// validar o canal sem acionar WhatsApp/e-mail/push reais nos testes.
const FUTURE = '2031-01-01T10:00:00'

describe('POST /api/communication — channel validation (P1)', () => {
  it('should reject an unknown channel with 400 and create nothing', async () => {
    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad Channel', body: 'Body', channel: 'carrier-pigeon', scheduledAt: FUTURE })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Canal inválido')

    expect(getDb().prepare('SELECT COUNT(*) AS c FROM messages').get()).toEqual({ c: 0 })
  })

  it('should reject a non-string channel with 400', async () => {
    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Numeric Channel', body: 'Body', channel: 42, scheduledAt: FUTURE })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Canal inválido')

    expect(getDb().prepare('SELECT COUNT(*) AS c FROM messages').get()).toEqual({ c: 0 })
  })

  it('should reject an object channel with 400', async () => {
    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Object Channel', body: 'Body', channel: { name: 'app' }, scheduledAt: FUTURE })
    expect(res.status).toBe(400)
    expect(getDb().prepare('SELECT COUNT(*) AS c FROM messages').get()).toEqual({ c: 0 })
  })

  it.each(['app', 'whatsapp', 'email', 'push', 'sms', 'all'])(
    'should accept the allowed channel "%s"',
    async (channel) => {
      const res = await request(app)
        .post('/api/communication')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Canal ${channel}`, body: 'Body', channel, scheduledAt: FUTURE })
      expect(res.status).toBe(201)
      expect(res.body.channel).toBe(channel)
    }
  )

  it('should keep defaulting to app when the channel is omitted or empty', async () => {
    const omitted = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sem Canal', body: 'Body', scheduledAt: FUTURE })
    expect(omitted.status).toBe(201)
    expect(omitted.body.channel).toBe('app')

    const empty = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Canal Vazio', body: 'Body', channel: '', scheduledAt: FUTURE })
    expect(empty.status).toBe(201)
    expect(empty.body.channel).toBe('app')
  })
})
