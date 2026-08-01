import type { MonthlyFee, MonthlyFeeStatus, Payment } from '../types/monthlyFee'

function parseDateBR(dateStr: string): number {
  const [day, month, year] = dateStr.split('/').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function calculateStatus(fee: MonthlyFee, payment?: Payment | null): MonthlyFeeStatus {
  if (fee.status === 'cancelled') return 'cancelled'
  if (fee.status === 'exempt') return 'exempt'
  if (payment) return 'paid'

  const dueDate = parseDateBR(fee.dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  if (today > dueDate) return 'overdue'

  return 'pending'
}

export function batchCalculateStatuses(fees: MonthlyFee[], payments: Record<string, Payment>): MonthlyFee[] {
  return fees.map((fee) => ({
    ...fee,
    status: calculateStatus(fee, payments[fee.id] || null),
  }))
}
