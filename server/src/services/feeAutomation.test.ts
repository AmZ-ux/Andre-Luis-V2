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

  it('marks pending fees past due as overdue with zero tolerance', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 10 }) // due 10/08 => 5 days late
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(1)
    const fee = getDb().prepare('SELECT status FROM monthly_fees').get() as any
    expect(fee.status).toBe('overdue')
  })

  it('keeps fees due on or after today as pending', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 15 }) // due 15/08 => 0 days late
    seedFee(pid, { month: 9, year: 2026, dueDay: 5, cpf: '111.111.111-22' })
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
    const fees = getDb().prepare('SELECT status FROM monthly_fees').all()
    expect(fees.every((f: any) => f.status === 'pending')).toBe(true)
  })

  it('respects a custom tolerance setting', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 10 }) // due 10/08 => 5 days late
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    settings.billing.toleranceDays = 5
    const updated = markOverdueFees(getDb(), settings, today)
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

  it('marks fee as overdue even with SUBPAYMENT', () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid, { month: 8, year: 2026, dueDay: 10 }) // due 10/08, today=15/08
    getDb().prepare(
      "INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, entry_type) VALUES (?, ?, ?, ?, 'pix', 'sub', 0, 0, 'SUBPAYMENT')"
    ).run(uuid(), feeId, 50, '12/08/2026')
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(1)
    const fee = getDb().prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('overdue')
  })

  it('keeps subpaid fee as pending when not yet past due', () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid, { month: 8, year: 2026, dueDay: 20 }) // due 20/08, today=15/08
    getDb().prepare(
      "INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, entry_type) VALUES (?, ?, ?, ?, 'pix', 'sub', 0, 0, 'SUBPAYMENT')"
    ).run(uuid(), feeId, 50, '14/08/2026')
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
    const fee = getDb().prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('pending')
  })

  it('does not mark fee overdue when NORMAL payment exists', () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid, { month: 8, year: 2026, dueDay: 10 })
    getDb().prepare(
      "INSERT INTO payments (id, monthly_fee_id, amount, payment_date, payment_method, notes, late_fee, interest, entry_type) VALUES (?, ?, ?, ?, 'pix', 'pay', 0, 0, 'NORMAL')"
    ).run(uuid(), feeId, 189.9, '12/08/2026')
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
  })

  it('does not mark fee overdue when status is exempt', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 10, status: 'exempt' })
    const updated = markOverdueFees(getDb(), DEFAULT_SETTINGS, today)
    expect(updated).toBe(0)
  })

  it('does not mark fee overdue when status is cancelled', () => {
    const pid = seedPassenger()
    seedFee(pid, { month: 8, year: 2026, dueDay: 10, status: 'cancelled' })
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

  // === Phase 2F.1 hardening tests ===

  describe('due_date: last valid day of month', () => {
    it('due_day 31 in January -> 31/01', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 1, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('31/01/2026')
    })

    it('due_day 31 in February 2026 (non-leap) -> 28/02', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 2, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('28/02/2026')
    })

    it('due_day 29 in February 2028 (leap) -> 29/02', () => {
      const pid = seedPassenger({ dueDay: 29 })
      generateMonthlyFees({ month: 2, year: 2028 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('29/02/2028')
    })

    it('due_day 29 in February 2026 (non-leap) -> 28/02', () => {
      const pid = seedPassenger({ dueDay: 29 })
      generateMonthlyFees({ month: 2, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('28/02/2026')
    })

    it('due_day 30 in February -> 28/02 (non-leap)', () => {
      const pid = seedPassenger({ dueDay: 30 })
      generateMonthlyFees({ month: 2, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('28/02/2026')
    })

    it('due_day 31 in April -> 30/04', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 4, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('30/04/2026')
    })

    it('due_day 31 in June -> 30/06', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 6, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('30/06/2026')
    })

    it('due_day 31 in September -> 30/09', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 9, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('30/09/2026')
    })

    it('due_day 31 in November -> 30/11', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 11, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('30/11/2026')
    })

    it('due_day 31 in month with 31 days -> 31', () => {
      const pid = seedPassenger({ dueDay: 31 })
      generateMonthlyFees({ month: 3, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('31/03/2026')
    })

    it('due_day 1 -> 01', () => {
      const pid = seedPassenger({ dueDay: 1 })
      generateMonthlyFees({ month: 2, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('01/02/2026')
    })

    it('due_day 28 -> 28', () => {
      const pid = seedPassenger({ dueDay: 28 })
      generateMonthlyFees({ month: 2, year: 2026 }, getDb())
      const fee = getDb().prepare('SELECT due_date FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.due_date).toBe('28/02/2026')
    })
  })

  describe('invalid due_day validation', () => {
    it('due_day 0 -> skips passenger, reports skippedInvalidDueDay', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 0)")
        .run(pid, 'InvalidDue', '111.111.111-01', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidDueDay).toBe(1)
    })

    it('due_day -1 -> skips passenger', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, -1)")
        .run(pid, 'InvalidDue2', '222.222.222-02', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidDueDay).toBe(1)
    })

    it('due_day 32 -> skips passenger', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 32)")
        .run(pid, 'InvalidDue3', '333.333.333-03', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidDueDay).toBe(1)
    })
  })

  describe('price validation', () => {
    it('monthly_fee = 0 -> skips passenger, reports skippedInvalidPrice', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 0, 5)")
        .run(pid, 'ZeroPrice', '111.111.111-01', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidPrice).toBe(1)
    })

    it('monthly_fee = -100 -> skips passenger', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', -100, 5)")
        .run(pid, 'NegPrice', '222.222.222-02', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidPrice).toBe(1)
    })

    it('monthly_fee = NULL -> skips passenger', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 5)")
        .run(pid, 'NullPrice', '333.333.333-03', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(0)
      expect(result.skippedInvalidPrice).toBe(1)
    })

    it('monthly_fee = -Infinity -> skips passenger', async () => {
      // SQLite doesn't support -Infinity, test the validation logic directly
      const { isValidPrice } = await import('./monthlyFeeGenerator.js')
      expect(isValidPrice(-Infinity)).toBe(false)
      expect(isValidPrice(Infinity)).toBe(false)
      expect(isValidPrice(NaN)).toBe(false)
    })

    it('valid positive price -> generates fee', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5)")
        .run(pid, 'ValidPrice', '444.444.444-04', '2000-01-01')
      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(1)
      expect(result.skippedInvalidPrice).toBe(0)
      const fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee.amount).toBe(189.90)
    })
  })

  describe('failure isolation: invalid passenger does not block others', () => {
    it('invalid price passenger does not block valid passengers', () => {
      const db = getDb()
      const pidA = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
        .run(pidA, 'ValidA', '111.111.111-01', '2000-01-01')
      const pidB = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 0, 5)")
        .run(pidB, 'InvalidB', '222.222.222-02', '2000-01-01')
      const pidC = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 500, 5)")
        .run(pidC, 'ValidC', '333.333.333-03', '2000-01-01')

      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(2)
      expect(result.skippedInvalidPrice).toBe(1)
      const fees = db.prepare('SELECT passenger_id FROM monthly_fees WHERE month = 7 AND year = 2026').all()
      expect(fees.map(f => f.passenger_id).sort()).toEqual([pidA, pidC].sort())
    })

    it('invalid due_day passenger does not block valid passengers', () => {
      const db = getDb()
      const pidA = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
        .run(pidA, 'ValidA', '555.555.555-04', '2000-01-01')
      const pidB = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 0)")
        .run(pidB, 'InvalidB', '666.666.666-05', '2000-01-01')
      const pidC = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
        .run(pidC, 'ValidC', '777.777.777-06', '2000-01-01')

      const result = generateMonthlyFees({ month: 7, year: 2026 }, db)
      expect(result.created).toBe(2)
      expect(result.skippedInvalidDueDay).toBe(1)
    })
  })

  describe('active route price snapshot & changes', () => {
    it('active route price change affects future fee only', () => {
      const db = getDb()
      const routeId = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
        .run(pid, 'PriceTest', '111.111.111-10', '2000-01-01', routeId)

      // Month 1 at price 400
      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)
      let fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee.amount).toBe(400)

      // Change route price
      db.prepare('UPDATE routes SET monthly_amount = 450 WHERE id = ?').run(routeId)
      db.prepare('UPDATE passengers SET monthly_fee = 450 WHERE route_id = ?').run(routeId)

      // Month 2 at new price
      generateMonthlyFees({ month: 8, year: 2026, passengerIds: [pid] }, db)
      let fee2 = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 8').get(pid) as any
      expect(fee2.amount).toBe(450)

      // Month 1 unchanged
      fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee.amount).toBe(400)
    })
  })

  describe('route migration', () => {
    it('migrating passenger to new route affects future fee only', () => {
      const db = getDb()
      const routeA = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeA)
      const routeB = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 500, 1)").run(routeB)

      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
        .run(pid, 'MigTest', '111.111.111-20', '2000-01-01', routeA)

      // Month 1 on route A
      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)
      let fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee.amount).toBe(400)

      // Migrate to route B
      db.prepare('UPDATE passengers SET route_id = ?, monthly_fee = 500 WHERE id = ?').run(routeB, pid)

      // Month 2 on route B
      generateMonthlyFees({ month: 8, year: 2026, passengerIds: [pid] }, db)
      let fee2 = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 8').get(pid) as any
      expect(fee2.amount).toBe(500)

      // Month 1 unchanged
      fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee.amount).toBe(400)
    })
  })

  describe('inactive route: existing passenger continues generation', () => {
    it('passenger on inactive route continues generating fees at preserved monthly_fee', () => {
      const db = getDb()
      const routeId = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
        .run(pid, 'InactiveRoute', '111.111.111-30', '2000-01-01', routeId)

      // Month 1 while active
      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)
      let fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee.amount).toBe(400)

      // Deactivate route
      db.prepare('UPDATE routes SET active = 0 WHERE id = ?').run(routeId)

      // Month 2 after deactivation
      generateMonthlyFees({ month: 8, year: 2026, passengerIds: [pid] }, db)
      let fee2 = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 8').get(pid) as any
      expect(fee2.amount).toBe(400) // preserved monthly_fee
    })

    it('new passengers cannot be associated with inactive route (enforced elsewhere)', () => {
      const db = getDb()
      const routeId = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 0)").run(routeId) // inactive
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee) VALUES (?, ?, ?, ?, 'university', 'active', 400)")
        .run(pid, 'NewPass', '222.222.222-40', '2000-01-01')

      // Generator would process but passenger has no route_id
      // This test documents that generator doesn't enforce route.active
      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)
      const fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(fee).toBeDefined()
      expect(fee.amount).toBe(400)
      // If passenger has monthly_fee set, it will generate
      // This is the current behavior - generator ignores route.active
    })
  })

  describe('legacy route_id=NULL', () => {
    it('passenger with NULL route_id and valid monthly_fee generates fee', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 189.90, 5, NULL)")
        .run(pid, 'Legacy', '333.333.333-50', '2000-01-01')

      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)
      const fee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ?').get(pid) as any
      expect(fee).toBeDefined()
      expect(fee.amount).toBe(189.90)
    })
  })

  describe('historical snapshot immutability', () => {
    it('route price change does not alter existing monthly_fee', () => {
      const db = getDb()
      const routeId = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeId)
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
        .run(pid, 'SnapTest', '111.111.111-40', '2000-01-01', routeId)

      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)

      db.prepare('UPDATE routes SET monthly_amount = 999 WHERE id = ?').run(routeId)
      db.prepare('UPDATE passengers SET monthly_fee = 999 WHERE route_id = ?').run(routeId)

      const existingFee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(existingFee.amount).toBe(400)
    })

    it('route migration does not alter existing monthly_fee', () => {
      const db = getDb()
      const routeA = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'A', 'B', 400, 1)").run(routeA)
      const routeB = uuid()
      db.prepare("INSERT INTO routes (id, origin, destination, monthly_amount, active) VALUES (?, 'C', 'D', 500, 1)").run(routeB)

      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, route_id) VALUES (?, ?, ?, ?, 'university', 'active', 400, ?)")
        .run(pid, 'SnapMig', '222.222.222-41', '2000-01-01', routeA)

      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)

      db.prepare('UPDATE passengers SET route_id = ?, monthly_fee = 500 WHERE id = ?').run(routeB, pid)

      const existingFee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(existingFee.amount).toBe(400)
    })

    it('passenger.monthly_fee change does not alter existing monthly_fee', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
        .run(pid, 'SnapFee', '333.333.333-60', '2000-01-01')

      generateMonthlyFees({ month: 7, year: 2026, passengerIds: [pid] }, db)

      db.prepare('UPDATE passengers SET monthly_fee = 999 WHERE id = ?').run(pid)

      const existingFee = db.prepare('SELECT amount FROM monthly_fees WHERE passenger_id = ? AND month = 7').get(pid) as any
      expect(existingFee.amount).toBe(400)
    })
  })

  describe('idempotency', () => {
    it('multiple runs produce single fee per passenger/month/year', () => {
      const pid = seedPassenger()
      generateMonthlyFees({ month: 7, year: 2026 }, getDb())
      generateMonthlyFees({ month: 7, year: 2026 }, getDb())
      generateMonthlyFees({ month: 7, year: 2026 }, getDb())

      const fees = getDb().prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = 7 AND year = 2026').all(pid)
      expect(fees).toHaveLength(1)
    })
  })

  describe('year rollover', () => {
    it('December -> January increments year', () => {
      const db = getDb()
      const pid = uuid()
      db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 400, 5)")
        .run(pid, 'YearRoll', '999.999.999-99', '2000-01-01')

      generateMonthlyFees({ month: 12, year: 2026, passengerIds: [pid] }, db)
      generateMonthlyFees({ month: 1, year: 2027, passengerIds: [pid] }, db)

      const feeDec = db.prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = 12 AND year = 2026').get(pid) as any
      const feeJan = db.prepare('SELECT * FROM monthly_fees WHERE passenger_id = ? AND month = 1 AND year = 2027').get(pid) as any

      expect(feeDec).toBeDefined()
      expect(feeJan).toBeDefined()
      expect(feeDec.month).toBe(12)
      expect(feeDec.year).toBe(2026)
      expect(feeJan.month).toBe(1)
      expect(feeJan.year).toBe(2027)
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
})
