import { storage } from './storage'
import { config } from '../config'
import { realMonthlyFees } from './realApi'
import type { Payment, MonthlyFeeStatus, MonthlyFee } from '../types/monthlyFee'
import type { PaymentMethod } from '../types/passenger'

const PAYMENTS_KEY = 'mock_payments'

function loadPayments(): Payment[] {
  return storage.get<Payment[]>(PAYMENTS_KEY) || []
}

function savePayments(payments: Payment[]): void {
  storage.set(PAYMENTS_KEY, payments)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const paymentService = {
  async register(
    monthlyFeeId: string,
    data: {
      amount: number
      paymentDate: string
      paymentMethod: PaymentMethod
      notes?: string
    }
  ): Promise<{ payment: Payment; feeStatus: MonthlyFeeStatus }> {
    if (config.realApi) {
      const res = await realMonthlyFees.pay(monthlyFeeId, {
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        notes: data.notes || '',
      })
      const payment = (res as any).payment as Payment
      return { payment, feeStatus: 'paid' }
    }
    await delay(400)

    const fees = storage.get<MonthlyFee[]>('mock_monthly_fees') || []
    const feeIdx = fees.findIndex((f) => f.id === monthlyFeeId)
    if (feeIdx === -1) throw new Error('Mensalidade não encontrada')

    const fee = fees[feeIdx]
    if (fee.status === 'paid' || fee.status === 'cancelled' || fee.status === 'exempt') {
      throw new Error('Não é possível registrar pagamento para esta mensalidade')
    }

    const existingPayments = loadPayments()
    const alreadyPaid = existingPayments.find((p) => p.monthlyFeeId === monthlyFeeId)
    if (alreadyPaid) throw new Error('Pagamento já registrado para esta mensalidade')

    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      monthlyFeeId,
      amount: data.amount,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      notes: data.notes || '',
      createdAt: new Date().toLocaleDateString('pt-BR'),
    }

    existingPayments.push(payment)
    savePayments(existingPayments)

    fees[feeIdx] = {
      ...fee,
      status: 'paid',
      payment,
      updatedAt: new Date().toLocaleDateString('pt-BR'),
    }
    storage.set('mock_monthly_fees', fees)

    return { payment, feeStatus: 'paid' }
  },

  async getByFeeId(monthlyFeeId: string): Promise<Payment | null> {
    await delay(100)
    const payments = loadPayments()
    return payments.find((p) => p.monthlyFeeId === monthlyFeeId) || null
  },

  async remove(monthlyFeeId: string): Promise<void> {
    await delay(200)
    const payments = loadPayments()
    savePayments(payments.filter((p) => p.monthlyFeeId !== monthlyFeeId))

    const fees = storage.get<MonthlyFee[]>('mock_monthly_fees') || []
    const feeIdx = fees.findIndex((f) => f.id === monthlyFeeId)
    if (feeIdx !== -1) {
      fees[feeIdx] = {
        ...fees[feeIdx],
        status: 'pending',
        payment: undefined,
        updatedAt: new Date().toLocaleDateString('pt-BR'),
      }
      storage.set('mock_monthly_fees', fees)
    }
  },
}
