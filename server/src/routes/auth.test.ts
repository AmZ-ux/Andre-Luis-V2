import { describe, it, expect, beforeAll, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb } from '../database/connection.js'
import authRoutes from '../routes/auth.js'

vi.hoisted(() => {
  process.env.DATABASE_PATH = ':memory:'
  process.env.LOGIN_RATE_LIMIT_MAX = '100'
  process.env.VERIFY_RATE_LIMIT_MAX = '100'
})

const app = express()
app.use(express.json())
app.use(sanitizeBody)
app.use('/api/auth', authRoutes)

beforeAll(async () => {
  await runMigrations()
  resetDb()
})

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Teste', email: 'teste@teste.com', cpf: '529.982.247-25', password: 'Test@123', birthDate: '2005-08-15' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.name).toBe('Teste')

    const db = (await import('../database/connection.js')).getDb()
    const passenger = db.prepare('SELECT monthly_fee, birth_date FROM passengers WHERE email = ?').get('teste@teste.com') as { monthly_fee: number; birth_date: string }
    expect(passenger.monthly_fee).toBe(189.9)
    expect(passenger.birth_date).toBe('2005-08-15')
  })

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Teste 2', email: 'teste@teste.com', cpf: '123.456.789-09', password: 'Test@123' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Usuário já existe')
  })

  it('should reject duplicate CPF', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Teste 3', email: 'outro@teste.com', cpf: '529.982.247-25', password: 'Test@123' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('Usuário já existe')
  })

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Teste' })
    expect(res.status).toBe(400)
  })

  it('should reject register when default monthly fee is not configured', async () => {
    const db = (await import('../database/connection.js')).getDb()
    db.prepare("INSERT OR REPLACE INTO settings (id, category, data) VALUES ('test-financial', 'financial', ?)").run(JSON.stringify({ defaultMonthlyFee: 0 }))
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Sem Valor', email: 'semvalor@teste.com', cpf: '111.444.777-35', password: 'Test@123' })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Mensalidade padrão não configurada. Contate a administração.')
    } finally {
      db.prepare('DELETE FROM settings WHERE id = ?').run('test-financial')
    }
  })

  it('should set due day and first fee due on the month after the contract start', async () => {
    const db = (await import('../database/connection.js')).getDb()
    db.prepare("INSERT OR REPLACE INTO settings (id, category, data) VALUES ('test-financial', 'financial', ?)").run(JSON.stringify({ defaultMonthlyFee: 249.9 }))
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Contrato Teste',
          email: 'contrato@teste.com',
          cpf: '987.654.321-00',
          password: 'Test@123',
          contractStartDate: '2026-09-10',
        })
      expect(res.status).toBe(201)

      const passenger = db.prepare('SELECT id, due_day, monthly_fee FROM passengers WHERE email = ?').get('contrato@teste.com') as { id: string; due_day: number; monthly_fee: number }
      expect(passenger.due_day).toBe(10)
      expect(passenger.monthly_fee).toBe(249.9)

      // Contrato inicia 10/09/2026 => primeira competencia 10/2026, vencimento 10/10/2026
      const fee = db.prepare(
        'SELECT amount, due_day, due_date, status, month, year FROM monthly_fees WHERE passenger_id = ? AND month = 10 AND year = 2026'
      ).get(passenger.id) as { amount: number; due_day: number; due_date: string; status: string; month: number; year: number } | undefined
      expect(fee).toBeDefined()
      expect(fee?.amount).toBe(249.9)
      expect(fee?.due_day).toBe(10)
      expect(fee?.due_date).toBe('10/10/2026')
      expect(fee?.status).toBe('pending')
    } finally {
      db.prepare('DELETE FROM settings WHERE id = ?').run('test-financial')
    }
  })

  it('should fall back to day 5 when contract start date is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Contrato Inválido',
        email: 'invalido@teste.com',
        cpf: '543.210.987-00',
        password: 'Test@123',
        contractStartDate: 'data-invalida',
      })
    expect(res.status).toBe(201)

    const db = (await import('../database/connection.js')).getDb()
    const passenger = db.prepare('SELECT due_day FROM passengers WHERE email = ?').get('invalido@teste.com')
    expect(passenger?.due_day).toBe(5)
  })

  it('should register new users with unverified email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Verif Teste', email: 'verif@teste.com', cpf: '135.790.246-00', password: 'Test@123' })
    expect(res.status).toBe(201)
    expect(res.body.user.emailVerified).toBe(false)
  })
})

describe('Email verification flow', () => {
  let token = ''

  beforeAll(async () => {
    resetDb()
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Verif Flow', email: 'flow@teste.com', cpf: '246.135.790-00', password: 'Test@123' })
    token = res.body.token
  })

  it('should send a verification code (demo mode returns the code)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.demoCode).toMatch(/^\d{6}$/)
  })

  it('should reject an incorrect code', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
    expect(res.status).toBe(400)
  })

  it('should confirm the email with the correct code', async () => {
    const sendRes = await request(app)
      .post('/api/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
    const code = sendRes.body.demoCode

    const res = await request(app)
      .post('/api/auth/verify-email/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(meRes.body.emailVerified).toBe(true)
  })

  it('should report already verified when sending again', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email/send')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.alreadyVerified).toBe(true)
  })

  it('should require authentication', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email/send')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/auth/profile', () => {
  let token = ''

  beforeAll(async () => {
    resetDb()
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Profile Teste', email: 'profile@teste.com', cpf: '321.654.987-00', password: 'Test@123' })
    token = res.body.token
  })

  it('should update name, phone and email', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', phone: '(11) 99999-0000', email: 'novo@teste.com' })
    expect(res.status).toBe(200)

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(meRes.body.name).toBe('Nome Atualizado')
    expect(meRes.body.phone).toBe('(11) 99999-0000')
    expect(meRes.body.email).toBe('novo@teste.com')
    expect(meRes.body.emailVerified).toBe(false)
  })

  it('should reject an invalid email', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'email-invalido' })
    expect(res.status).toBe(400)
  })

  it('should reject a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Outro User', email: 'outro@teste.com', cpf: '789.123.456-00', password: 'Test@123' })

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'outro@teste.com' })
    expect(res.status).toBe(409)
  })

  it('should require authentication', async () => {
    const res = await request(app)
      .put('/api/auth/profile')
      .send({ name: 'Sem Token' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    resetDb()
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login Test', email: 'login@teste.com', cpf: '111.222.333-44', password: 'Senha@123' })
  })

  it('should allow unverified passenger login (email verification is optional)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'login@teste.com', password: 'Senha@123' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.emailVerified).toBe(false)
  })

  it('should verify email through the public flow and then login', async () => {
    const sendRes = await request(app)
      .post('/api/auth/verify-email/send-public')
      .send({ email: 'login@teste.com' })
    expect(sendRes.status).toBe(200)
    expect(sendRes.body.demoCode).toMatch(/^\d{6}$/)

    const confirmRes = await request(app)
      .post('/api/auth/verify-email/confirm-public')
      .send({ email: 'login@teste.com', code: sendRes.body.demoCode })
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.success).toBe(true)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'login@teste.com', password: 'Senha@123' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.name).toBe('Login Test')
    expect(res.body.user.emailVerified).toBe(true)
  })

  it('should return demoCode in production when EMAIL_DISABLED is set', async () => {
    const prevEnv = process.env.NODE_ENV
    const prevEmail = process.env.EMAIL_DISABLED
    try {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Demo Email', email: 'demoemail@teste.com', cpf: '555.666.777-88', password: 'Senha@123' })
      process.env.NODE_ENV = 'production'
      process.env.EMAIL_DISABLED = 'true'
      const sendRes = await request(app)
        .post('/api/auth/verify-email/send-public')
        .send({ email: 'demoemail@teste.com' })
      expect(sendRes.status).toBe(200)
      expect(sendRes.body.demoCode).toMatch(/^\d{6}$/)
    } finally {
      process.env.NODE_ENV = prevEnv
      if (prevEmail === undefined) delete process.env.EMAIL_DISABLED
      else process.env.EMAIL_DISABLED = prevEmail
    }
  })

  it('should login with CPF', async () => {    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: '111.222.333-44', password: 'Senha@123' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  it('should reject invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'login@teste.com', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('should reject non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'naoexiste@teste.com', password: 'Test@123' })
    expect(res.status).toBe(401)
  })

  it('should return 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
    expect(res.status).toBe(400)
  })
})
