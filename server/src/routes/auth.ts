import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import rateLimit from 'express-rate-limit'
import { getDb } from '../database/connection.js'
import { loadSettings } from '../services/settingsService.js'
import { signToken, authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation.js'
import { sendEmail, emailDisabled } from '../services/emailService.js'
import { notifyAdmins } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/login', loginLimiter, validateBody('login', 'password'), (req, res) => {
  const { login, password } = req.body
  const db = getDb()

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR cpf = ?').get(login, login) as any
  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas' })
    return
  }

  const now = Date.now()
  const lockedUntil = Number(user.locked_until || 0)
  if (lockedUntil > now) {
    const minsLeft = Math.ceil((lockedUntil - now) / 60000)
    res.status(423).json({ error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minsLeft} min.` })
    return
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    const attempts = Number(user.failed_login_attempts || 0) + 1
    const maxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5
    if (attempts >= maxAttempts) {
      const lockMinutes = Number(process.env.LOGIN_LOCK_MINUTES) || 15
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = ? WHERE id = ?')
        .run(String(now + lockMinutes * 60000), user.id)
      db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuid(), 'login_blocked', `Conta bloqueada por ${lockMinutes} min após ${maxAttempts} tentativas de login falhas`, user.email, user.role, 'security')
      res.status(423).json({ error: `Muitas tentativas com credenciais inválidas. Conta bloqueada por ${lockMinutes} minutos.` })
    } else {
      db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id)
      res.status(401).json({ error: 'Credenciais inválidas' })
    }
    return
  }

  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_access = datetime(\'now\') WHERE id = ?').run(user.id)
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'login', 'Login realizado', user.name, user.role, 'login')

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
      superAdmin: !!user.super_admin,
      emailVerified: !!user.email_verified,
      createdAt: user.created_at,
      lastAccess: user.last_access,
    },
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  })
})

router.post('/register', validateBody('name', 'email', 'cpf', 'password'), (req, res) => {
  const { name, email, cpf, password, phone, transportType, pickupPoint, destination, contractStartDate, birthDate } = req.body
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

  // Valor da mensalidade vem da configuração da empresa, nunca do passageiro
  const settings = loadSettings(db)
  const feeValue = Number(settings.financial.defaultMonthlyFee) || 0
  if (feeValue <= 0) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    res.status(400).json({ error: 'Mensalidade padrão não configurada. Contate a administração.' })
    return
  }

  let dueDay = 5
  if (contractStartDate && /^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) {
    dueDay = Number(contractStartDate.slice(8, 10))
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 5
  }

  // Also create passenger record
  db.prepare(`
    INSERT INTO passengers (
      id, name, cpf, birth_date, phone, email, transport_type, status,
      pickup_point, destination, contract_start_date, due_day, monthly_fee
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
  `).run(
    id, name, cpf,
    (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) ? birthDate : '2000-01-01',
    phone || '', email, type,
    pickupPoint || '', destination || '', contractStartDate || '', dueDay, feeValue
  )

  // Primeira mensalidade: competencia do mes ATUAL (mes do cadastro),
  // vencendo no dia do contrato. Aparece pendente no dashboard logo apos o cadastro.
  const now = new Date()
  const feeMonth = now.getMonth() + 1
  const feeYear = now.getFullYear()

  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?, 'pending')
  `).run(
    uuid(), id, name, cpf, type,
    feeMonth, feeYear, feeValue, dueDay,
    `${String(dueDay).padStart(2, '0')}/${String(feeMonth).padStart(2, '0')}/${feeYear}`
  )

  const token = signToken({ userId: id, role: 'passenger' })
  res.status(201).json({
    user: { id, name, email, cpf, phone: phone || '', photo: '', role: 'passenger', superAdmin: false, emailVerified: false, createdAt: new Date().toISOString(), lastAccess: new Date().toISOString() },
    token,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  })
})

router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  const passenger = req.user.role === 'passenger'
    ? db.prepare('SELECT status FROM passengers WHERE id = ?').get(req.user.userId) as any
    : undefined
  res.json({
    id: user.id, name: user.name, email: user.email, cpf: user.cpf,
    phone: user.phone, photo: user.photo, role: user.role,
    superAdmin: !!user.super_admin,
    emailVerified: !!user.email_verified,
    contractStatus: passenger ? passenger.status : undefined,
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
  await sendEmail(
    to,
    'Código de verificação de email',
    `<p>Olá, ${name}!</p><p>Seu código de verificação é:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>O código expira em 30 minutos.</p>`
  )
}

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.VERIFY_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/verify-email/send', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const user = db.prepare('SELECT id, name, email, email_verified, verify_token, verify_token_expires FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  if (user.email_verified) {
    res.json({ success: true, alreadyVerified: true })
    return
  }

  const now = Date.now()
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = now + 30 * 60 * 1000
  db.prepare('UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?').run(code, expiresAt, user.id)

  const isProd = process.env.NODE_ENV === 'production'
  if (!process.env.RESEND_API_KEY && isProd && !emailDisabled()) {
    res.status(503).json({ error: 'Envio de email indisponível no momento. Contate o suporte.' })
    return
  }
  void sendVerificationEmail(user.email, user.name, code).catch((err) => {
    logger.error({ err: String(err) }, 'Verification email failed')
  })

  res.json({
    success: true,
    demoCode: emailDisabled() || !isProd ? code : undefined,
  })
})

// Verificação pública (antes do login): o código chega ao email do próprio passageiro.
router.post('/verify-email/send-public', verifyLimiter, validateBody('email'), (req, res) => {
  const { email } = req.body
  const db = getDb()
  const user = db.prepare('SELECT id, name, email, email_verified, verify_token, verify_token_expires FROM users WHERE email = ?').get(email) as any
  if (!user) { res.json({ success: true }); return }
  if (user.email_verified) {
    res.json({ success: true, alreadyVerified: true })
    return
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 30 * 60 * 1000
  db.prepare('UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?').run(code, expiresAt, user.id)

  const isProd = process.env.NODE_ENV === 'production'
  if (!process.env.RESEND_API_KEY && isProd && !emailDisabled()) {
    res.status(503).json({ error: 'Envio de email indisponível no momento. Contate o suporte.' })
    return
  }
  void sendVerificationEmail(user.email, user.name, code).catch((err) => {
    logger.error({ err: String(err) }, 'Verification email failed')
  })

  res.json({ success: true, demoCode: emailDisabled() || !isProd ? code : undefined })
})

router.post('/verify-email/confirm-public', verifyLimiter, validateBody('email', 'code'), (req, res) => {
  const { email, code } = req.body
  const db = getDb()
  const user = db.prepare('SELECT id, email_verified, verify_token, verify_token_expires FROM users WHERE email = ?').get(email) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }

  if (!user.verify_token || !user.verify_token_expires || Date.now() > user.verify_token_expires) {
    res.status(400).json({ error: 'Código expirado. Solicite um novo.' })
    return
  }
  if (String(code).trim() !== user.verify_token) {
    res.status(400).json({ error: 'Código incorreto' })
    return
  }

  db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_token_expires = NULL WHERE id = ?').run(user.id)
  res.json({ success: true })
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

router.post('/end-contract', authMiddleware, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  if (req.user.role !== 'passenger') {
    res.status(403).json({ error: 'Apenas passageiros podem encerrar o próprio contrato' })
    return
  }

  const db = getDb()
  const passenger = db.prepare('SELECT * FROM passengers WHERE id = ?').get(req.user.userId) as any
  if (!passenger) {
    res.status(404).json({ error: 'Passageiro não encontrado' })
    return
  }
  if (passenger.status === 'inactive') {
    res.status(400).json({ error: 'Seu contrato já está encerrado' })
    return
  }
  if (passenger.status === 'blocked') {
    res.status(400).json({ error: 'Contratos bloqueados devem ser encerrados pela administração' })
    return
  }

  db.prepare("UPDATE passengers SET status = 'inactive', updated_at = datetime('now') WHERE id = ?").run(req.user.userId)

  // Cancela mensalidades em aberto e cobranças PIX pendentes para não gerar novos lembretes
  const fees = db.prepare("SELECT id FROM monthly_fees WHERE passenger_id = ? AND status IN ('pending', 'overdue')").all(req.user.userId) as any[]
  for (const fee of fees) {
    db.prepare("UPDATE monthly_fees SET status = 'cancelled', cancellation_reason = 'Contrato encerrado pelo passageiro', updated_at = datetime('now') WHERE id = ?").run(fee.id)
    db.prepare("UPDATE pix_charges SET status = 'cancelled', updated_at = datetime('now') WHERE monthly_fee_id = ? AND status = 'pending'").run(fee.id)
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.userId) as any
  notifyAdmins(
    db,
    'Contrato encerrado',
    `${user.name} (${user.email}) encerrou o contrato${fees.length > 0 ? ` — ${fees.length} mensalidade(s) em aberto foram canceladas` : ''}.`,
    { type: 'warning', link: `/passageiros/${req.user.userId}` }
  )

  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'contract_end', `Passageiro encerrou o contrato${fees.length > 0 ? ` (${fees.length} mensalidades canceladas)` : ''}`, user.name, 'passenger', 'contract')

  logger.info({ userId: req.user.userId, cancelledFees: fees.length }, 'Contract ended by passenger')
  res.json({ success: true, status: 'inactive', cancelledFees: fees.length })
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

router.post('/logout', authMiddleware, (req, res) => {
  const db = getDb()
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'logout', 'Logout realizado', req.user!.role === 'admin' ? 'Administrador' : 'Passageiro', req.user!.role, 'logout')
  res.json({ success: true })
})

router.post('/forgot-password', validateBody('email'), async (req, res) => {
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

  const appUrl = process.env.APP_URL || 'https://andre-luis-v2-production.up.railway.app'
  const resetLink = `${appUrl}/redefinir-senha?token=${resetToken}`
  try {
    await sendEmail(
      user.email,
      'Redefinição de senha',
      `<p>Olá, ${user.name}!</p><p>Recebemos um pedido de redefinição de senha.</p><p><a href="${resetLink}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Redefinir senha</a></p><p>O link expira em 1 hora. Se não foi você, ignore este email.</p>`
    )
  } catch (err) {
    logger.error({ err: String(err) }, 'Password reset email failed')
    res.status(503).json({ error: 'Envio de email indisponível no momento. Tente novamente mais tarde.' })
    return
  }

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
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, failed_login_attempts = 0, locked_until = NULL WHERE id = ?'
  ).run(bcrypt.hashSync(password, 10), user.id)

  res.json({ success: true, message: 'Senha redefinida com sucesso.' })
})

export default router
