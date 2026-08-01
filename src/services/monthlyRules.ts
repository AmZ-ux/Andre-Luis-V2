import type { MonthlyFee } from '../types/monthlyFee'

export const monthlyRules = {
  canEdit(fee: MonthlyFee): boolean {
    return fee.status !== 'paid' && fee.status !== 'cancelled' && fee.status !== 'exempt'
  },

  canPay(fee: MonthlyFee): boolean {
    return fee.status === 'pending' || fee.status === 'overdue'
  },

  canCancel(fee: MonthlyFee): boolean {
    return fee.status !== 'paid' && fee.status !== 'cancelled'
  },

  canExempt(fee: MonthlyFee): boolean {
    return fee.status !== 'paid' && fee.status !== 'exempt'
  },

  validateAmount(value: string): string | null {
    const num = parseFloat(value.replace(',', '.'))
    if (isNaN(num) || num <= 0) return 'O valor deve ser maior que zero'
    return null
  },

  validateDueDay(value: string): string | null {
    const num = parseInt(value)
    if (isNaN(num) || num < 1 || num > 31) return 'Dia de vencimento inválido (1-31)'
    return null
  },

  validatePaymentDate(value: string): string | null {
    if (!value) return 'Data é obrigatória'
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (isNaN(date.getTime())) return 'Data inválida'
    return null
  },
}
