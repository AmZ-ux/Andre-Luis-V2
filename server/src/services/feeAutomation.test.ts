import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb } from '../database/connection.js'
import { markOverdueFees, sendPaymentReminders, buildDailySummary, notifyDailySummaryToAdmins, notifyPaymentReceived } from './feeAutomation.js'
import { DEFAULT_SETTINGS } from './settingsService.js'
import { generateMonthlyFees } from './monthlyFeeGenerator.js'

process.env.DATABASE_PATH = ':memory:'

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
})

function seedPassenger(overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day, phone) VALUES (?, ?, ?, ?, 'university', ?, ?, ?, ?)")
    .run(id, overrides.name ?? 'Test Passenger', overrides.cpf ?? '111.111.111-11', '2000-01-01', overrides.status ?? 'active', overrides.monthlyFee ?? 189.9, overrides.dueDay ?? 5, overrides.phone ?? '(11) 99999-9999')
  return id
}

function seedFee(passengerId: string, overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  const month = overrides.month ?? 7
  const year = overrides.year ?? 2026
  db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, 'university', ?, ?, ?, ?, ?, ?)
  `).run(
    id, passengerId, overrides.passengerName ?? 'Test Passenger', overrides.cpf ?? '111.111.111-11',
    month, year, overrides.amount ?? 189.9, overrides.dueDay ?? 5,
    `${String(month).padStart(2, '0')}/${year}`,
    overrides.status ?? 'pending'
  )
  return id
}

describe('markOverdueFees', () => {
  const today = new Date(2026, 7, 15)

  it('marks pending fees past due beyond tolerance as overdue', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 6, year: 2026, dueDay: 5 }) // due 05/06 => 41 days late
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(1)
    const fee = getDb().prepare('SELECT status FROM monthly_fees').get() as any
    expect(fee.status).toBe('overdue')
  })

  it('keeps fees within tolerance as pending', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 10 }) // due 10/08 => 5 days late = tolerance
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
    const fee = getDb().prepare('SELECT status FROM monthly_fees').get() as any
    expect(fee.status).toBe('pending')
  })

  it('does not touch paid or future fees', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 6, year: 2026, dueDay: 5, status: 'paid' })
    seedFee(pid, { month: 9, year: 2026, dueDay: 5 })
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
  })
})

describe('generateMonthlyFees', () => {
  it('creates fees for active passengers', () => {
    const pid = seedPassenger()
    const result = generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    expect(result.created).toBe(1)
    const fee = getDb().prepare('SELECT * FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
    expect(fee.month).toBe(7)
    expect(fee.amount).toBe(189.9)
    expect(fee.status).toBe('pending')
  })

  it('skips existing fees and reports count', () => {
    seedPassenger()
    generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    const result = generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    expect(result.created).toBe(0)
    expect(result.skippedExisting).toBe(1)
  })

  it('skips inactive and blocked passengers', () => {
    seedPassenger({ cpf: '111.111.111-12', status: 'inactive' })
    seedPassenger({ cpf: '111.111.111-13', status: 'blocked' })
    seedPassenger({ cpf: '111.111.111-14', status: 'active' })
    const result = generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    expect(result.created).toBe(1)
    expect(result.skippedInactive).toBe(2)
  })

  it('skips vacation status passengers in fixed vacation months', () => {
    seedPassenger({ cpf: '111.111.111-15', status: 'vacation' })
    const july = generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    expect(july.skippedVacation).toBe(1)
    const march = generateMonthlyFees({ month: 3, year: 2026 }, getDb())
    expect(march.created).toBe(1)
  })

  it('skips passengers on vacation overlapping the month', () => {
    const pid = seedPassenger()
    const db = getDb()
    db.prepare("INSERT INTO availabilities (id, passenger_id, passenger_name, cpf, transport_type, type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, 'university', 'vacation', ?, ?, '', 'scheduled')")
      .run(uuid(), pid, 'Test Passenger', '111.111.111-11', '01/07/2026', '31/07/2026')
    const result = generateMonthlyFees({ month: 7, year: 2026 }, getDb())
    expect(result.skippedVacation).toBe(1)
  })

  it('honors passengerIds filter', () => {
    const pidA = seedPassenger({ cpf: '111.111.111-16' })
    seedPassenger({ cpf: '111.111.111-17' })
    const result = generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pidA] }, getDb())
    expect(result.created).toBe(1)
  })

  it('generates fees for vacation months when policy is not no_charge', () => {
    seedPassenger({ cpf: '111.111.111-18', status: 'vacation' })
    const db = getDb()
    db.prepare("INSERT INTO settings (id, category, data) VALUES (?, 'billing', ?)").run(uuid(), JSON.stringify({ vacationPolicy: 'full' }))
    const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
    expect(result.created).toBe(1)
  })
})

describe('sendPaymentReminders', () => {
  const today = new Date(2026, 7, 15)

  it('does nothing when autoMessages is disabled', async () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 20 }) // due 20/08 => 5 days ahead
    const result = await sendPaymentReminders(getDb(), DEFAULT_SETTINGS, today)
    expect(result.autoMessagesDisabled).toBe(true)
    expect(result.remindersSent).toBe(0)
  })

  it('sends reminders for fees due in reminderDaysBefore days and creates notifications', async () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 20 }) // due 20/08, reminderDaysBefore=5
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.communication.autoMessages = true
    const result = await sendPaymentReminders(getDb(), settings, today)
    expect(result.autoMessagesDisabled).toBe(false)
    expect(result.remindersSent).toBe(1)
    const notifications = getDb().prepare('SELECT * FROM notifications').all()
    expect(notifications.length).toBe(1)
    expect(notifications[0].user_id).toBe(pid)
  })

it('sends reminders for overdue fees', async () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 7, year: 2026, dueDay: 1 }) // due 01/07 => 45 days late
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.communication.autoMessages = true
    const result = await sendPaymentReminders(getDb(), settings, today)
    expect(result.remindersSent).toBe(1)
  })
})

describe('buildDailySummary & notifyDailySummaryToAdmins', () => {
  it('counts pending and overdue fees', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 6, year: 2026, dueDay: 5, status: 'pending' })
    seedFee(pid, { month: 8, year: 2026, dueDay: 20, status: 'overdue' })
    const summary = buildDailySummary(getDb())
    expect(summary.pending).toBe(1)
    expect(summary.overdue).toBe(1)
    expect(summary.total).toBe(2)
  })

  it('notifies all admins when there are pending fees', () => {
    const db = getDb()
    const admin1 = uuid()
    const admin2 = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', 'x')")
      .run(admin1, 'Admin1', 'admin1@test.com', '111.111.111-11')
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', 'x')")
      .run(admin2, 'Admin2', '111.111.111-12', '111.111.111-12')

    const pid = seedPassenger()
    seedFee(pid, { status: 'pending' })
    notifyDailySummaryToAdmins(db, buildDailySummary(db))

    const forAdmin1 = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(admin1)
    const forAdmin2 = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(admin2)
    expect(forAdmin1.length).toBe(1)
    expect(forAdmin2.length).toBe(1)
    expect(forAdmin1[0].title).toBe('Resumo diário de pagamentos')
  })

  it('does not notify admins when there is nothing pending', () => {
    const db = getDb()
    const admin = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', 'x')")
      .run(admin, 'Admin', 'admin-sum@test.com', '222.222.222-22')
    notifyDailySummaryToAdmins(db, { pending: 0, overdue: 0, total: 0 })
    const rows = db.prepare('SELECT * FROM notifications').all()
    expect(rows.length).toBe(0)
  })
})

describe('notifyPaymentReceived', () => {
  it('notifies the passenger and all admins', () => {
    const db = getDb()
    const outerAdmin = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', 'x')")
      .run(outerAdmin, 'Admin', 'outer@test.com', '333.333.333-33')

    const pid = seedPassenger()
    const feeId = seedFee(pid, { month: 7, year: 2026, amount: 189.9, passengerName: 'Cliente Exemplo' })
    const fee = db.prepare('SELECT * FROM monthly_fees WHERE id = ?').get(feeId)
    notifyPaymentReceived(db, fee, { amount: 189.9 })

    const passengerNotif = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(pid)
    const adminNotif = db.prepare('SELECT * FROM notifications WHERE user_id = ?').all(outerAdmin)
    expect(passengerNotif.length).toBe(1)
    expect(passengerNotif[0].title).toBe('Pagamento registrado')
    expect(adminNotif.length).toBe(1)
expect(adminNotif[0].title).toContain('Cliente Exemplo')
  })
})
