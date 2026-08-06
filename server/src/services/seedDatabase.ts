import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { logger } from '../utils/logger.js'
import { getDb } from '../database/connection.js'

const WEAK_PASSWORDS = ['admin123', 'password', '123456', '12345678', 'qwerty', 'admin', 'senha', 'senha123']

function resolveSuperAdminPassword(): string {
  const pw = process.env.SUPER_ADMIN_PASSWORD
  if (!pw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPER_ADMIN_PASSWORD é obrigatória em produção. Defina uma senha forte no ambiente.')
    }
    return 'admin123'
  }
  if (WEAK_PASSWORDS.includes(pw.toLowerCase())) {
    throw new Error('SUPER_ADMIN_PASSWORD muito fraca. Escolha uma senha forte (não use valores comuns como admin123).')
  }
  return pw
}

export async function runSeed(): Promise<void> {
  await runMigrations()
  const db = getDb()

  // Seed apenas em banco novo (vazio). Em produção com dados reais o seed
  // nunca deve recriar as contas de demonstração.
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
  if (existing.c > 0) {
    logger.info({ users: existing.c }, 'Database already has data — seed skipped')
    return
  }

  const superAdminPassword = resolveSuperAdminPassword()
  const ADMIN_ID = uuid()
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@transporte.com'
  const PASSWORD_HASH = bcrypt.hashSync(superAdminPassword, 10)

  // Default admin user (super admin — o criador do projeto)
  db.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, cpf, phone, role, super_admin, email_verified, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
  `).run(ADMIN_ID, 'Administrador', superAdminEmail, '000.000.000-00', '(11) 99999-9999', 'admin', PASSWORD_HASH)

  logger.info({ superAdmin: superAdminEmail }, 'Database seeded with super admin')
}
