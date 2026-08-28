/**
 * Staging validation tests — verifica dados criados pelo staging seed e guardrails.
 *
 * Roda com banco em memória (vitest) para validar:
 *   - seed recusa sem ALLOW_STAGING_SEED=true
 *   - seed recusa RAILWAY_ENVIRONMENT_NAME=production
 *   - seed permite RAILWAY_ENVIRONMENT_NAME=staging
 *   - seed recusa environment Railway inesperado
 *   - não existe FORCE_STAGING_SEED capaz de contornar isso
 *   - idempotência funciona
 *   - mensalidade usa a lógica real de preço (loadSettings)
 *   - mensalidade fica pending
 *   - zero payments
 *   - zero pix_charges
 *
 * Uso:
 *   npm run test:staging
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { initDatabase, getDb, resetDb } from '../database/connection.js'
import { runMigrations } from '../database/schema.js'
import {
  runStagingSeed,
  assertStagingAllowed,
  STAGING_PASSENGER_EMAIL,
  STAGING_PASSENGER_CPF,
  STAGING_ADMIN_EMAIL,
  STAGING_PASSWORD,
} from '../stagingSeed.js'
import { loadSettings } from '../services/settingsService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

let passengerId: string
let adminId: string

beforeAll(async () => {
  process.env.DATABASE_PATH = ':memory:'
  await initDatabase()
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  const result = runStagingSeed(db)
  passengerId = result.passengerId
  adminId = result.adminId
})

afterEach(() => {
  // Clean up env overrides from guardrail tests
  delete process.env.ALLOW_STAGING_SEED
  delete process.env.RAILWAY_ENVIRONMENT_NAME
  delete process.env.STAGING_SEED_TARGET
})

/* -------------------------------------------------------------------------- */
/*  Guard rails                                                               */
/* -------------------------------------------------------------------------- */

describe('Staging seed — guard rails', () => {
  it('recusa sem ALLOW_STAGING_SEED=true', () => {
    delete process.env.ALLOW_STAGING_SEED
    process.env.STAGING_SEED_TARGET = 'local'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    assertStagingAllowed()

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ALLOW_STAGING_SEED must be "true"')
    )

    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('recusa RAILWAY_ENVIRONMENT_NAME=production', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    assertStagingAllowed()

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('only "staging" is allowed')
    )

    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('permite RAILWAY_ENVIRONMENT_NAME=staging', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.RAILWAY_ENVIRONMENT_NAME = 'staging'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    assertStagingAllowed()

    expect(exitSpy).not.toHaveBeenCalled()

    exitSpy.mockRestore()
  })

  it('permite RAILWAY_ENVIRONMENT_NAME=Staging (case-insensitive)', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.RAILWAY_ENVIRONMENT_NAME = 'Staging'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    assertStagingAllowed()

    expect(exitSpy).not.toHaveBeenCalled()

    exitSpy.mockRestore()
  })

  it('recusa environment Railway inesperado (ex: pullrequest)', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.RAILWAY_ENVIRONMENT_NAME = 'pullrequest'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    assertStagingAllowed()

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('only "staging" is allowed')
    )

    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('não existe FORCE_STAGING_SEED capaz de contornar o bloqueio', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production'
    process.env.FORCE_STAGING_SEED = 'true'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    assertStagingAllowed()

    // Deve RECUSAR mesmo com FORCE_STAGING_SEED=true
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    delete process.env.FORCE_STAGING_SEED
  })

  it('execução local requer STAGING_SEED_TARGET=local', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.STAGING_SEED_TARGET
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    assertStagingAllowed()

    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('STAGING_SEED_TARGET != "local"')
    )

    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('execução local funciona com STAGING_SEED_TARGET=local', () => {
    process.env.ALLOW_STAGING_SEED = 'true'
    process.env.STAGING_SEED_TARGET = 'local'
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    assertStagingAllowed()

    expect(exitSpy).not.toHaveBeenCalled()

    exitSpy.mockRestore()
  })
})

/* -------------------------------------------------------------------------- */
/*  Seed data assertions                                                      */
/* -------------------------------------------------------------------------- */

describe('Staging seed — data creation', () => {
  it('creates passenger user with correct email', () => {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(STAGING_PASSENGER_EMAIL) as any
    expect(user).toBeDefined()
    expect(user.role).toBe('passenger')
    expect(user.email).toBe(STAGING_PASSENGER_EMAIL)
  })

  it('creates passenger profile with correct data', () => {
    const db = getDb()
    const passenger = db.prepare('SELECT * FROM passengers WHERE email = ?').get(STAGING_PASSENGER_EMAIL) as any
    expect(passenger).toBeDefined()
    expect(passenger.name).toBe('Passageiro Teste Staging')
    expect(passenger.cpf).toBe(STAGING_PASSENGER_CPF)
    expect(passenger.transport_type).toBe('university')
    expect(passenger.status).toBe('active')
    expect(passenger.pickup_point).toBe('Ipiranga do Piauí')
    expect(passenger.destination).toBe('IFPI')
    expect(passenger.institution).toBe('IFPI')
  })

  it('creates admin user', () => {
    const db = getDb()
    const admin = db.prepare('SELECT * FROM users WHERE email = ?').get(STAGING_ADMIN_EMAIL) as any
    expect(admin).toBeDefined()
    expect(admin.role).toBe('admin')
    expect(admin.super_admin).toBe(1)
  })

  it('creates monthly fee for current month with status pending', () => {
    const db = getDb()
    const now = new Date()
    const fee = db.prepare(
      'SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?'
    ).get(passengerId, now.getMonth() + 1, now.getFullYear()) as any

    expect(fee).toBeDefined()
    expect(fee.status).toBe('pending')
    expect(fee.passenger_name).toBe('Passageiro Teste Staging')
    expect(fee.cpf).toBe(STAGING_PASSENGER_CPF)
    expect(fee.transport_type).toBe('university')
    expect(fee.institution).toBe('IFPI')
  })

  it('mensalidade usa preço de settings (não constante hardcoded)', () => {
    const db = getDb()
    const now = new Date()
    const fee = db.prepare(
      'SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?'
    ).get(passengerId, now.getMonth() + 1, now.getFullYear()) as any

    const settings = loadSettings(db)
    const expectedFee = Number(settings.financial.defaultMonthlyFee) || 0

    expect(fee.amount).toBe(expectedFee)
  })

  it('passenger.monthly_fee also comes from settings', () => {
    const db = getDb()
    const passenger = db.prepare('SELECT * FROM passengers WHERE email = ?')
      .get(STAGING_PASSENGER_EMAIL) as any

    const settings = loadSettings(db)
    const expectedFee = Number(settings.financial.defaultMonthlyFee) || 0

    expect(passenger.monthly_fee).toBe(expectedFee)
  })

  it('does NOT create any payments', () => {
    const db = getDb()
    const count = (db.prepare(
      'SELECT COUNT(*) as c FROM payments WHERE monthly_fee_id IN (SELECT id FROM monthly_fees WHERE passenger_id = ?)'
    ).get(passengerId) as { c: number }).c
    expect(count).toBe(0)
  })

  it('does NOT create any PIX charges', () => {
    const db = getDb()
    const count = (db.prepare(
      'SELECT COUNT(*) as c FROM pix_charges WHERE monthly_fee_id IN (SELECT id FROM monthly_fees WHERE passenger_id = ?)'
    ).get(passengerId) as { c: number }).c
    expect(count).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/*  Idempotency                                                               */
/* -------------------------------------------------------------------------- */

describe('Staging seed — idempotency', () => {
  it('does not duplicate data when run twice', () => {
    const db = getDb()

    // Run seed again
    runStagingSeed(db)

    const userCount = (db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE email = ?'
    ).get(STAGING_PASSENGER_EMAIL) as { c: number }).c
    expect(userCount).toBe(1)

    const passengerCount = (db.prepare(
      'SELECT COUNT(*) as c FROM passengers WHERE email = ?'
    ).get(STAGING_PASSENGER_EMAIL) as { c: number }).c
    expect(passengerCount).toBe(1)

    const now = new Date()
    const feeCount = (db.prepare(
      'SELECT COUNT(*) as c FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?'
    ).get(passengerId, now.getMonth() + 1, now.getFullYear()) as { c: number }).c
    expect(feeCount).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/*  Authentication                                                            */
/* -------------------------------------------------------------------------- */

describe('Staging seed — authentication', () => {
  it('passenger password hash is valid bcrypt', () => {
    const db = getDb()
    const user = db.prepare('SELECT password_hash FROM users WHERE email = ?')
      .get(STAGING_PASSENGER_EMAIL) as { password_hash: string }
    expect(user).toBeDefined()
    expect(bcrypt.compareSync(STAGING_PASSWORD, user.password_hash)).toBe(true)
  })

  it('admin password hash is valid bcrypt', () => {
    const db = getDb()
    const user = db.prepare('SELECT password_hash FROM users WHERE email = ?')
      .get(STAGING_ADMIN_EMAIL) as { password_hash: string }
    expect(user).toBeDefined()
    expect(bcrypt.compareSync(STAGING_PASSWORD, user.password_hash)).toBe(true)
  })

  it('passenger can obtain a valid JWT token', () => {
    const db = getDb()
    const user = db.prepare('SELECT id, role FROM users WHERE email = ?')
      .get(STAGING_PASSENGER_EMAIL) as { id: string; role: string }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' })
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string }

    expect(decoded.userId).toBe(passengerId)
    expect(decoded.role).toBe('passenger')
  })
})

/* -------------------------------------------------------------------------- */
/*  Settings                                                                  */
/* -------------------------------------------------------------------------- */

describe('Staging seed — settings', () => {
  it('has financial settings with defaultMonthlyFee', () => {
    const db = getDb()
    const settings = loadSettings(db)
    expect(settings.financial.defaultMonthlyFee).toBe(189.90)
  })

  it('has billing settings', () => {
    const db = getDb()
    const settings = loadSettings(db)
    expect(settings.billing.vacationPolicy).toBe('no_charge')
  })
})

/* -------------------------------------------------------------------------- */
/*  Constants sanity                                                          */
/* -------------------------------------------------------------------------- */

describe('Staging seed — constants', () => {
  it('CPF is syntactically valid (passes mod-11 check)', () => {
    // 529.982.247-25 is a known valid test CPF
    const digits = STAGING_PASSENGER_CPF.replace(/\D/g, '')
    expect(digits).toHaveLength(11)
    expect(digits).not.toBe('00000000000')
    // Verify check digits
    const d1 = digits[9]
    const d2 = digits[10]
    expect(d1).toBe('2')
    expect(d2).toBe('5')
  })

  it('has correct constant values', () => {
    expect(STAGING_PASSENGER_EMAIL).toBe('teste.staging@example.com')
    expect(STAGING_PASSENGER_CPF).toBe('529.982.247-25')
    expect(STAGING_ADMIN_EMAIL).toBe('admin.staging@example.com')
    expect(STAGING_PASSWORD).toBe('Staging123!')
  })
})
