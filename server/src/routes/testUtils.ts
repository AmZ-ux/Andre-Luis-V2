import jwt from 'jsonwebtoken'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

function ensureUser(role: string, email: string, superAdmin = 0): string {
  const db = getDb()
  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined
  if (!user) {
    const id = uuid()
    db.prepare(
      'INSERT INTO users (id, name, email, cpf, phone, role, super_admin, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, role, email, `000.000.${role.length}-${superAdmin}`, '', role, superAdmin, 'x')
    user = { id }
  }
  return user.id
}

function tokenFor(role: string, email: string, superAdmin = 0): string {
  const userId = ensureUser(role, email, superAdmin)
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' })
}

export function getSuperAdminToken(): string {
  return tokenFor('admin', 'super@teste.com', 1)
}

export function getAdminToken(): string {
  return tokenFor('admin', 'admin-comum@teste.com')
}

export function getPassengerToken(): string {
  return tokenFor('passenger', 'passageiro-token@teste.com')
}
