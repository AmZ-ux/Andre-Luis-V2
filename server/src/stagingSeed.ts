/**
 * Staging seed — cria dados fictícios para validação do ambiente de staging.
 *
 * Proteções:
 *   - Requer ALLOW_STAGING_SEED=true
 *   - Em Railway: requer RAILWAY_ENVIRONMENT_NAME=staging (fail-closed)
 *   - Local: requer STAGING_SEED_TARGET=local (segundo opt-in)
 *   - Sem bypass para produção
 *   - Idempotente: roden múltiplas vezes sem duplicar dados
 *
 * Uso (Railway):
 *   npm run seed:staging          # requer RAILWAY_ENVIRONMENT_NAME=staging
 *
 * Uso (local):
 *   npm run seed:staging:local    # requer STAGING_SEED_TARGET=local
 */

import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { initDatabase, getDb, type DatabaseWrapper } from './database/connection.js'
import { runMigrations } from './database/schema.js'
import { loadSettings } from './services/settingsService.js'

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

export const STAGING_PASSENGER_EMAIL = 'teste.staging@example.com'
export const STAGING_PASSENGER_CPF = '529.982.247-25'
export const STAGING_ADMIN_EMAIL = 'admin.staging@example.com'
export const STAGING_PASSWORD = 'Staging123!'

/* -------------------------------------------------------------------------- */
/*  Guard rails                                                               */
/* -------------------------------------------------------------------------- */

export function assertStagingAllowed(): void {
  if (process.env.ALLOW_STAGING_SEED !== 'true') {
    console.error(
      '\n❌ ALLOW_STAGING_SEED must be "true" to run this seed.\n' +
      '   Refusing to avoid accidental data creation.\n'
    )
    process.exit(1)
  }

  const railwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME

  if (railwayEnv !== undefined) {
    // Railway detected — only "staging" is allowed (case-insensitive)
    if (railwayEnv.toLowerCase() !== 'staging') {
      console.error(
        `\n❌ RAILWAY_ENVIRONMENT_NAME="${railwayEnv}" — only "staging" is allowed.\n` +
        '   Refusing to seed data in non-staging Railway environment.\n'
      )
      process.exit(1)
    }
    // RAILWAY_ENVIRONMENT_NAME=staging → allowed
    return
  }

  // Not Railway — require explicit local opt-in
  if (process.env.STAGING_SEED_TARGET !== 'local') {
    console.error(
      '\n❌ RAILWAY_ENVIRONMENT_NAME not set and STAGING_SEED_TARGET != "local".\n' +
      '   To seed locally, run:\n' +
      '     npm run seed:staging:local\n'
    )
    process.exit(1)
  }
}

/* -------------------------------------------------------------------------- */
/*  Core seed (reusable — accepts db instance)                                */
/* -------------------------------------------------------------------------- */

export function runStagingSeed(db: DatabaseWrapper): { passengerId: string; adminId: string } {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Read fee from settings (same logic the app uses at registration)
  const settings = loadSettings(db)
  const feeValue = Number(settings.financial.defaultMonthlyFee) || 0

  let passengerId = ''
  let adminId = ''

  const runInTransaction = db.transaction(() => {
    // ── 1. Ensure settings exist (financial + billing) ──────────────────────
    const existingFinancial = db.prepare(
      "SELECT id FROM settings WHERE category = 'financial'"
    ).get()

    if (!existingFinancial) {
      db.prepare(
        "INSERT INTO settings (id, category, data, created_at, updated_at) VALUES (?, 'financial', ?, ?, ?)"
      ).run(
        uuid(),
        JSON.stringify({
          currency: 'BRL', currencyFormat: 'BRL', decimalPlaces: 2,
          defaultDueDay: 5, allowCustomDueDate: true,
          defaultMonthlyFee: 189.90,
          allowDiscount: false, allowLateFee: false, allowInterest: false,
        }),
        now.toISOString(), now.toISOString()
      )
    }

    const existingBilling = db.prepare(
      "SELECT id FROM settings WHERE category = 'billing'"
    ).get()

    if (!existingBilling) {
      db.prepare(
        "INSERT INTO settings (id, category, data, created_at, updated_at) VALUES (?, 'billing', ?, ?, ?)"
      ).run(
        uuid(),
        JSON.stringify({
          toleranceDays: 0, autoChargeInterest: false, autoChargeLateFee: false,
          allowExemption: true, allowPartialPayment: false, allowAnticipation: false,
          allowRenegotiation: false, vacationPolicy: 'no_charge',
          lateFeePercent: 2, interestRatePerDay: 0.033, reminderDaysBefore: 5,
        }),
        now.toISOString(), now.toISOString()
      )
    }

    // ── 2. Admin user ────────────────────────────────────────────────────────
    const existingAdmin = db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).get(STAGING_ADMIN_EMAIL) as { id: string } | undefined

    if (!existingAdmin) {
      adminId = uuid()
      const passwordHash = bcrypt.hashSync(STAGING_PASSWORD, 10)
      db.prepare(
        `INSERT INTO users (id, name, email, cpf, phone, role, super_admin, email_verified, password_hash)
         VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, ?)`
      ).run(adminId, 'Admin Staging', STAGING_ADMIN_EMAIL, '000.000.000-01', '(11) 90000-0001', passwordHash)
    } else {
      adminId = existingAdmin.id
    }

    // ── 3. Passenger user + profile ───────────────────────────────────────────
    const existingPassenger = db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).get(STAGING_PASSENGER_EMAIL) as { id: string } | undefined

    if (!existingPassenger) {
      passengerId = uuid()
      const passwordHash = bcrypt.hashSync(STAGING_PASSWORD, 10)

      db.prepare(
        `INSERT INTO users (id, name, email, cpf, phone, role, password_hash)
         VALUES (?, ?, ?, ?, ?, 'passenger', ?)`
      ).run(passengerId, 'Passageiro Teste Staging', STAGING_PASSENGER_EMAIL, STAGING_PASSENGER_CPF, '(11) 90000-0002', passwordHash)

      // feeValue comes from loadSettings above — same logic as registration
      db.prepare(
        `INSERT INTO passengers (
          id, name, cpf, birth_date, phone, email, transport_type, status,
          pickup_point, destination, institution, contract_start_date, due_day, monthly_fee
        ) VALUES (?, ?, ?, '2000-06-15', ?, ?, 'university', 'active', 'Ipiranga do Piauí', 'IFPI', 'IFPI', ?, 5, ?)`
      ).run(passengerId, 'Passageiro Teste Staging', STAGING_PASSENGER_CPF, '(11) 90000-0002', STAGING_PASSENGER_EMAIL, `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`, feeValue)
    } else {
      passengerId = existingPassenger.id
    }

    // ── 4. Monthly fee (current month, pending) ──────────────────────────────
    const existingFee = db.prepare(
      'SELECT id FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?'
    ).get(passengerId, currentMonth, currentYear) as { id: string } | undefined

    if (!existingFee) {
      const dueDay = 5
      const dueDate = `${String(dueDay).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}/${currentYear}`

      // amount = feeValue from settings (same source as registration + fee generator)
      db.prepare(
        `INSERT INTO monthly_fees (
          id, passenger_id, passenger_name, cpf, transport_type,
          institution, company, month, year, amount, due_day, due_date, status
        ) VALUES (?, ?, ?, ?, 'university', 'IFPI', '', ?, ?, ?, ?, ?, 'pending')`
      ).run(uuid(), passengerId, 'Passageiro Teste Staging', STAGING_PASSENGER_CPF, currentMonth, currentYear, feeValue, dueDay, dueDate)
    }
  })

  runInTransaction()
  return { passengerId, adminId }
}

/* -------------------------------------------------------------------------- */
/*  CLI entry point                                                           */
/* -------------------------------------------------------------------------- */

async function cli(): Promise<void> {
  assertStagingAllowed()

  await initDatabase()
  await runMigrations()

  const db = getDb()
  const { passengerId, adminId } = runStagingSeed(db)

  const settings = loadSettings(db)
  const feeValue = Number(settings.financial.defaultMonthlyFee) || 0

  console.log('\n── Staging seed summary ──')
  console.log(`  Admin:     ${STAGING_ADMIN_EMAIL} (id: ${adminId})`)
  console.log(`  Passenger: ${STAGING_PASSENGER_EMAIL} (id: ${passengerId})`)
  console.log(`  Password:  ${STAGING_PASSWORD}`)
  console.log(`  Origin:    Ipiranga do Piauí`)
  console.log(`  Destiny:   IFPI`)
  console.log(`  Monthly fee: current month, R$ ${feeValue.toFixed(2)}, pending`)
  console.log('\n✅ Staging seed completed.\n')
}

// Only run CLI when executed directly (not when imported by tests)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('stagingSeed.ts') || process.argv[1].endsWith('stagingSeed.js')
)

if (isDirectRun) {
  cli().catch((err) => {
    console.error('❌ Staging seed failed:', err)
    process.exit(1)
  })
}
