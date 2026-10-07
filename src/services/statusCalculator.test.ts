import { describe, it, expect } from 'vitest'
import { calculateStatus, batchCalculateStatuses } from './statusCalculator'
import type { MonthlyFee, Payment } from '../types/monthlyFee'

function makeFee(overrides: Partial<MonthlyFee> = {}): MonthlyFee {
  return {
    id: 'fee-1',
    passengerId: 'pass-1',
    passengerName: 'Passageiro Teste',
    cpf: '000.000.000-00',
    transportType: 'school',
    month: 10,
    year: 2026,
    amount: 0.2,
    dueDay: 28,
    dueDate: '31/12/2099',
    status: 'pending',
    createdAt: '2026-10-01 12:00:00',
    updatedAt: '2026-10-01 12:00:00',
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    monthlyFeeId: 'fee-1',
    amount: 0.2,
    paymentDate: '07/10/2026',
    paymentMethod: 'pix',
    createdAt: '2026-10-07 05:24:58',
    ...overrides,
  }
}

describe('calculateStatus', () => {
  it('1. fee.status = paid + payment undefined → paid (defect fix)', () => {
    const fee = makeFee({ status: 'paid', dueDate: '28/10/2026' })
    expect(calculateStatus(fee, undefined)).toBe('paid')
  })

  it('2. fee.status = paid + payment existente → paid', () => {
    const fee = makeFee({ status: 'paid', dueDate: '28/10/2026', payment: makePayment() })
    expect(calculateStatus(fee, makePayment())).toBe('paid')
  })

  it('3. fee.status = pending + sem payment + não vencida → pending', () => {
    const fee = makeFee({ status: 'pending', dueDate: '31/12/2099' })
    expect(calculateStatus(fee, undefined)).toBe('pending')
  })

  it('4. fee.status = pending + vencida → overdue', () => {
    const fee = makeFee({ status: 'pending', dueDate: '01/01/2020' })
    expect(calculateStatus(fee, undefined)).toBe('overdue')
  })

  it('5. fee.status = cancelled → cancelled', () => {
    const fee = makeFee({ status: 'cancelled', dueDate: '01/01/2020' })
    expect(calculateStatus(fee, undefined)).toBe('cancelled')
    expect(calculateStatus(fee, makePayment())).toBe('cancelled')
  })

  it('6. fee.status = exempt → exempt', () => {
    const fee = makeFee({ status: 'exempt', dueDate: '01/01/2020' })
    expect(calculateStatus(fee, undefined)).toBe('exempt')
    expect(calculateStatus(fee, makePayment())).toBe('exempt')
  })

  it('mantém o comportamento legado: pending + payment existente → paid', () => {
    const fee = makeFee({ status: 'pending', dueDate: '31/12/2099', payment: makePayment() })
    expect(calculateStatus(fee, makePayment())).toBe('paid')
  })

  it('mantém o comportamento legado: overdue + payment existente → paid', () => {
    const fee = makeFee({ status: 'overdue', dueDate: '01/01/2020', payment: makePayment() })
    expect(calculateStatus(fee, makePayment())).toBe('paid')
  })
})

describe('batchCalculateStatuses', () => {
  it('aplica o mesmo mapeamento para o mapa de payments', () => {
    const fees = [
      makeFee({ id: 'a', status: 'paid', dueDate: '28/10/2026' }),
      makeFee({ id: 'b', status: 'pending', dueDate: '31/12/2099' }),
      makeFee({ id: 'c', status: 'pending', dueDate: '01/01/2020' }),
    ]
    const result = batchCalculateStatuses(fees, {})
    expect(result.map((f) => f.status)).toEqual(['paid', 'pending', 'overdue'])
  })
})
