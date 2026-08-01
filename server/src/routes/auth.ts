import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import rateLimit from 'express-rate-limit'
import { getDb } from '../database/connection.js'
import { signToken, authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation.js'
import { logger } from '../utils/logger.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/login', loginLimiter, validateBody('login', 'password'), (req, res) => {
  const { login, password } = req.body
  const db = getDb()

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR cpf = ?').get(login, login) as any
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Credenciais inválidas' })
    return
  }

  db.prepare('UPDATE users SET last_access = datetime(\'now\') WHERE id = ?').run(user.id)

  const token = signToken({ userId: user.id, role: user.role })
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      phone: user.phone,
      photo: user.photo,
      role: user.role,
      createdAt: user.created_at,
      lastAccess: user.last_access,
    },
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  })
})

router.post('/register', validateBody('name', 'email', 'cpf', 'password'), (req, res) => {
  const { name, email, cpf, password, phone, transportType, pickupPoint, destination, contractStartDate } = req.body
  const db = getDb()

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR cpf = ?').get(email, cpf)
  if (existing) {
    res.status(409).json({ error: 'Usuário já existe' })
    return
  }

  const id = uuid()
  const passwordHash = bcrypt.hashSync(password, 10)

  db.prepare(`
    INSERT INTO users (id, name, email, cpf, phone, role, password_hash)
    VALUES (?, ?, ?, ?, ?, 'passenger', ?)
  `).run(id, name, email, cpf, phone || '', passwordHash)

  const validTypes = ['university', 'school', 'contract']
  const type = validTypes.includes(transportType) ? transportType : 'university'

  let dueDay = 5
  if (contractStartDate && /^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) {
    dueDay = Number(contractStartDate.slice(8, 10))
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 5
  }

  // Also create passenger record
  db.prepare(`
    INSERT INTO passengers (
      id, name, cpf, birth_date, phone, email, transport_type, status,
      pickup_point, destination, contract_start_date, due_day
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).run(
    id, name, cpf, '2000-01-01', phone || '', email, type,
    pickupPoint || '', destination || '', contractStartDate || '', dueDay
  )

  // Create current month fee automatically
  const now = new Date()
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, '', '', ?, ?, 0, ?, ?, 'pending')
  `).run(
    uuid(), id, name, cpf, type,
    now.getMonth() + 1, now.getFullYear(), dueDay,
    `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  )

  const token = signToken({ userId: id, role: 'passenger' })
  res.status(201).json({
    user: { id, name, email, cpf, phone: phone || '', photo: '', role: 'passenger', emailVerified: false, createdAt: new Date().toISOString(), lastAccess: new Date().toISOString() },
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  })
})

router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  res.json({
    id: user.id, name: user.name, email: user.email, cpf: user.cpf,
    phone: user.phone, photo: user.photo, role: user.role,
    emailVerified: !!user.email_verified,
    createdAt: user.created_at, lastAccess: user.last_access,
  })
})

router.put('/profile', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const { name, phone, photo, email } = req.body
  const db = getDb()

  if (email !== undefined) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Email inválido' })
      return
    }
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.userId)
    if (duplicate) {
      res.status(409).json({ error: 'Email já está em uso' })
      return
    }
    db.prepare('UPDATE users SET email = ?, email_verified = 0, verify_token = NULL, verify_token_expires = NULL WHERE id = ?')
      .run(email, req.user.userId)
    db.prepare('UPDATE passengers SET email = ? WHERE id = ?').run(email, req.user.userId)
  }

  const sets: string[] = []
  const params: any[] = []
  if (name !== undefined) { sets.push('name = ?'); params.push(String(name)) }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(String(phone || '')) }
  if (photo !== undefined) { sets.push('photo = ?'); params.push(String(photo || '')) }
  if (sets.length > 0) {
    params.push(req.user.userId)
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  res.json({ success: true })
})

async function sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.info({ to, code }, 'Resend not configured — verification code (dev mode)')
    return
  }
  const from = process.env.RESEND_FROM || 'Transporte André Luis <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Código de verificação de email',
      html: `<p>Olá, ${name}!</p><p>Seu código de verificação é:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>O código expira em 30 minutos.</p>`,
    }),
  })
  if (!res.ok) {
    logger.error({ error: await res.text() }, 'Resend send failed')
  }
}

router.post('/verify-email/send', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const user = db.prepare('SELECT id, name, email, email_verified FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  if (user.email_verified) {
    res.json({ success: true, alreadyVerified: true })
    return
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 30 * 60 * 1000
  db.prepare('UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?').run(code, expiresAt, user.id)
  sendVerificationEmail(user.email, user.name, code)

  res.json({
    success: true,
    demoCode: process.env.RESEND_API_KEY ? undefined : code,
  })
})

router.post('/verify-email/confirm', authMiddleware, validateBody('code'), (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const user = db.prepare('SELECT id, email_verified, verify_token, verify_token_expires FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }

  if (!user.verify_token || !user.verify_token_expires || Date.now() > user.verify_token_expires) {
    res.status(400).json({ error: 'Código expirado. Solicite um novo.' })
    return
  }
  if (String(req.body.code).trim() !== user.verify_token) {
    res.status(400).json({ error: 'Código incorreto' })
    return
  }

  db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?').run(user.id)
  res.json({ success: true })
})

router.put('/change-password', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const { currentPassword, newPassword } = req.body
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId) as any
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(400).json({ error: 'Senha atual incorreta' })
    return
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), req.user.userId)
  res.json({ success: true })
})

router.post('/refresh', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const token = signToken({ userId: req.user.userId, role: req.user.role })
  res.json({ token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
})

router.post('/logout', authMiddleware, (_req, res) => {
  res.json({ success: true })
})

router.post('/forgot-password', validateBody('email'), (req, res) => {
  const { email } = req.body
  const db = getDb()

  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email) as any
  if (!user) {
    res.json({ success: true, message: 'Se o email existir, você receberá instruções.' })
    return
  }

  const resetToken = uuid().replace(/-/g, '').slice(0, 32)
  const expiresAt = Date.now() + 60 * 60 * 1000

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
    .run(resetToken, expiresAt, user.id)

  // In production, send email via nodemailer / SendGrid / etc.
  logger.info({ email }, 'Password reset token generated')

  res.json({ success: true, message: 'Se o email existir, você receberá instruções.' })
})

router.post('/reset-password', validateBody('token', 'password'), (req, res) => {
  const { token, password } = req.body
  const db = getDb()

  const user = db.prepare(
    'SELECT id, reset_token_expires FROM users WHERE reset_token = ?'
  ).get(token) as any

  if (!user || Date.now() > user.reset_token_expires) {
    res.status(400).json({ error: 'Token inválido ou expirado.' })
    return
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?'
  ).run(bcrypt.hashSync(password, 10), user.id)

  res.json({ success: true, message: 'Senha redefinida com sucesso.' })
})

export default router
