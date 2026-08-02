import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validation.js'

// Gestão de administradores — somente super admin.
// O super admin é o criador do projeto; ele cria/promove os admins
// que operam o transporte (ex.: o comprador do projeto).

const router = Router()

router.use(authMiddleware)

function requireSuperAdmin(req: any, res: any, next: any): void {
  const db = getDb()
  const user = db.prepare('SELECT super_admin FROM users WHERE id = ?').get(req.user?.userId) as any
  if (req.user?.role !== 'admin' || !user?.super_admin) {
    res.status(403).json({ error: 'Apenas o super administrador' })
    return
  }
  next()
}

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

router.post('/admins', requireSuperAdmin, validateBody('name', 'email', 'password'), (req, res) => {
  const { name, email, password } = req.body
  if (String(password).length < 8) {
    res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' })
    return
  }
  const db = getDb()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim().toLowerCase())
  if (existing) {
    res.status(409).json({ error: 'Já existe um usuário com este email' })
    return
  }
  const id = uuid()
  db.prepare(
    'INSERT INTO users (id, name, email, cpf, phone, role, password_hash, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  ).run(id, String(name).trim(), String(email).trim().toLowerCase(), '', '', 'admin', bcrypt.hashSync(String(password), 10))
  res.status(201).json({ id, name: String(name).trim(), email: String(email).trim().toLowerCase(), role: 'admin', superAdmin: false, emailVerified: false })
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

export default router
