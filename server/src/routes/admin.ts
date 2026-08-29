import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation.js'
import { requireSuperAdmin } from '../middleware/roles.js'

// Gestão de administradores — somente super admin.
// O super admin é o criador do projeto; ele cria/promove os admins
// que operam o transporte (ex.: o comprador do projeto).

const router = Router()

router.use(authMiddleware)

router.get('/admins', requireSuperAdmin, (req, res) => {
  const db = getDb()
  const admins = db.prepare(
    'SELECT id, name, email, phone, role, super_admin, email_verified, last_access, created_at FROM users WHERE role = ? ORDER BY super_admin DESC, name ASC'
  ).all('admin') as any[]
  res.json(admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
    superAdmin: !!a.super_admin,
    emailVerified: !!a.email_verified,
    lastAccess: a.last_access,
    createdAt: a.created_at,
  })))
})

router.post('/admins', requireSuperAdmin, validateBody('email', 'password'), (req, res) => {
  const { email, password } = req.body
  if (String(password).length < 8) {
    res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' })
    return
  }
  const name = String(req.body.name ?? '').trim() || 'Administrador'
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim().toLowerCase())
  if (existing) {
    res.status(409).json({ error: 'Já existe um usuário com este email' })
    return
  }
  const id = uuid()
  // Servidor exige cpf UNIQUE; admins criados não têm CPF real, então usa-se
  // um placeholder determinístico e exclusivo por conta.
  const cpfRaw = id.replace(/-/g, '').slice(0, 11).split('').map((ch) => String(parseInt(ch, 16) % 10)).join('')
  const cpf = `${cpfRaw.slice(0, 3)}.${cpfRaw.slice(3, 6)}.${cpfRaw.slice(6, 9)}-${cpfRaw.slice(9, 11)}`
  // Conta criada diretamente pelo super admin: as credenciais são entregues ao
  // responsável do transporte, então o email já nasce verificado (ele entra direto).
  db.prepare(
    'INSERT INTO users (id, name, email, cpf, phone, role, password_hash, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(id, name, String(email).trim().toLowerCase(), cpf, '', 'admin', bcrypt.hashSync(String(password), 10))
  res.status(201).json({ id, name, email: String(email).trim().toLowerCase(), role: 'admin', superAdmin: false, emailVerified: true })
})

router.post('/promote', requireSuperAdmin, validateBody('userId'), (req, res) => {
  const { userId } = req.body
  const db = getDb()
  const user = db.prepare('SELECT id, name, email, role, super_admin FROM users WHERE id = ?').get(userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  if (user.role === 'admin') {
    res.status(400).json({ error: 'Este usuário já é administrador' })
    return
  }
  db.prepare('UPDATE users SET role = ?, super_admin = 0 WHERE id = ?').run('admin', userId)
  res.json({ success: true, id: userId, name: user.name, role: 'admin' })
})

router.post('/demote', requireSuperAdmin, validateBody('userId'), (req, res) => {
  const { userId } = req.body
  const db = getDb()
  const user = db.prepare('SELECT id, name, role, super_admin FROM users WHERE id = ?').get(userId) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  if (user.super_admin) {
    res.status(400).json({ error: 'O super administrador não pode ser rebaixado' })
    return
  }
  if (user.role !== 'admin') {
    res.status(400).json({ error: 'Este usuário não é administrador' })
    return
  }
  db.prepare("UPDATE users SET role = 'passenger' WHERE id = ?").run(userId)
  res.json({ success: true, id: userId, name: user.name, role: 'passenger' })
})

router.delete('/admins/:id', requireSuperAdmin, (req, res) => {
  const db = getDb()
  const user = db.prepare('SELECT id, name, role, super_admin FROM users WHERE id = ?').get(req.params.id) as any
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return }
  if (user.super_admin) {
    res.status(400).json({ error: 'O super administrador não pode ser removido' })
    return
  }
  if (user.role !== 'admin') {
    res.status(400).json({ error: 'Este usuário não é administrador' })
    return
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ success: true, id: req.params.id })
})

// Limpa todos os dados operacionais (passageiros, mensalidades, pagamentos,
// notificações, etc.), preservando apenas o super admin e as configurações.
// Uso: preparação para entrada em produção real — os passageiros passam a se
// cadastrar sozinhos via link público.
router.post('/reset-data', requireSuperAdmin, (req, res) => {
  const db = getDb()
  const superAdminId = req.user?.userId

  const tables = [
    'availability_history',
    'pix_charges',
    'payments',
    'notifications',
    'audit_logs',
    'messages',
    'availabilities',
    'monthly_fees',
    'passengers',
  ]
  for (const table of tables) {
    db.prepare(`DELETE FROM "${table}"`).run()
  }
  db.prepare('DELETE FROM users WHERE id != ?').run(superAdminId)

  res.json({ success: true, message: 'Dados operacionais limpos. Mantidos: super admin e configurações.' })
})

export default router
