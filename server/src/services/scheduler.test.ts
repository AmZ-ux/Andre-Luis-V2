import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb } from '../database/connection.js'

vi.mock('./mercadopagoService.js', () => ({
  getPayment: vi.fn(),
  mpStatus: (s: string) => {
    if (s === 'approved') return 'paid'
    if (s === 'rejected' || s === 'cancelled') return 'cancelled'
    return 'pending'
  },
}))

import { getPayment } from './mercadopagoService.js'
import { runPaymentReconciliation } from './scheduler.js'

process.env.DATABASE_PATH = ':memory:'

const mockGetPayment = getPayment as ReturnType<typeof vi.fn>

function seedPassenger(): string {
  const db = getDb()
  const id = uuid()
  db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status) VALUES (?, ?, ?, ?, 'university', 'active')")
    .run(id, 'Test Passenger', '111.111.111-11', '2000-01-01')
  return id
}

function seedFee(passengerId: string, month = 7, year = 2026): string {
  const db = getDb()
  const id = uuid()
  db.prepare("INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
    .run(id, passengerId, 'Test Passenger', '111.111.111-11', 'university', month, year, 189.90, 5, '07/2026')
  return id
}

function seedCharge(feeId: string, minutesAgo = 15, status = 'pending'): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO pix_charges (id, payment_intent_id, monthly_fee_id, amount, status, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', ?))
  `).run(id, `mp-${id}`, feeId, 189.90, status, `-${minutesAgo} minutes`)
  return id
}

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  mockGetPayment.mockReset()
})

describe('runPaymentReconciliation', () => {
  it('should finalize a paid charge older than 10 minutes', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    const chargeId = seedCharge(feeId)
    const charge = getDb().prepare('SELECT payment_intent_id FROM pix_charges WHERE id = ?').get(chargeId) as any
    mockGetPayment.mockResolvedValue({
      id: 12345,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
    })

    await runPaymentReconciliation()

    const db = getDb()
    const payment = db.prepare('SELECT * FROM payments WHERE monthly_fee_id = ?').get(feeId) as any
    expect(payment).toBeTruthy()
    expect(payment.amount).toBe(189.9)
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('paid')
    const updatedCharge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(updatedCharge.status).toBe('succeeded')
    // Should call getPayment with the specific payment_intent_id
    expect(mockGetPayment).toHaveBeenCalledWith(Number(charge.payment_intent_id))
  })

  it('should mark cancelled charges as cancelled', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    const chargeId = seedCharge(feeId)
    mockGetPayment.mockResolvedValue({
      id: 12346,
      status: 'cancelled',
      status_detail: 'expired',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
    })

    await runPaymentReconciliation()

    const db = getDb()
    const updatedCharge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(updatedCharge.status).toBe('cancelled')
    const fee = db.prepare('SELECT status FROM monthly_fees WHERE id = ?').get(feeId) as any
    expect(fee.status).toBe('pending')
  })

  it('should leave pending charges untouched when MP payment is still pending', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    const chargeId = seedCharge(feeId)
    mockGetPayment.mockResolvedValue({
      id: 12347,
      status: 'in_process',
      status_detail: 'pending_review',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
    })

    await runPaymentReconciliation()

    const db = getDb()
    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('pending')
  })

  it('should not consult MP for charges created less than 10 minutes ago', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    seedCharge(feeId, 2)

    await runPaymentReconciliation()

    expect(mockGetPayment).not.toHaveBeenCalled()
  })

  it('should expire charges older than PIX expiry when MP has no payment', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    const chargeId = seedCharge(feeId, 25 * 60)
    mockGetPayment.mockRejectedValue(new Error('not found'))

    await runPaymentReconciliation()

    const db = getDb()
    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('expired')
  })

  it('should keep charge pending when MP has no payment but charge is recent', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid)
    const chargeId = seedCharge(feeId, 15)
    mockGetPayment.mockRejectedValue(new Error('not found'))

    await runPaymentReconciliation()

    const db = getDb()
    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('pending')
  })

  it('should record overpayment when fee is already paid', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid, 7, 2026)
    const db = getDb()
    // Mark fee as paid
    db.prepare("UPDATE monthly_fees SET status = 'paid' WHERE id = ?").run(feeId)
    const chargeId = seedCharge(feeId)
    mockGetPayment.mockResolvedValue({
      id: 99999,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
    })

    await runPaymentReconciliation()

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(feeId)
    expect(payments.length).toBe(1)
    expect(payments[0].amount).toBe(189.9)
    const charge = db.prepare('SELECT status FROM pix_charges WHERE id = ?').get(chargeId) as any
    expect(charge.status).toBe('succeeded_overpaid')
  })

  it('should not create duplicate overpayment for same paymentId', async () => {
    const pid = seedPassenger()
    const feeId = seedFee(pid, 7, 2026)
    const db = getDb()
    db.prepare("UPDATE monthly_fees SET status = 'paid' WHERE id = ?").run(feeId)
    seedCharge(feeId)
    mockGetPayment.mockResolvedValue({
      id: 88888,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 189.9,
      payment_method_id: 'pix',
    })

    // Run reconciliation twice
    await runPaymentReconciliation()
    await runPaymentReconciliation()

    const payments = db.prepare("SELECT * FROM payments WHERE monthly_fee_id = ? AND notes LIKE '%OVERPAYMENT%'").all(feeId)
    expect(payments.length).toBe(1)
  })
})
