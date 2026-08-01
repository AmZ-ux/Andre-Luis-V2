import { cn } from '../../utils/cn'
import type { MonthlyFeeStatus as Status } from '../../types/monthlyFee'

interface MonthlyFeeStatusProps {
  status: Status
  className?: string
}

const variants: Record<Status, { label: string; classes: string }> = {
  pending: { label: 'Pendente', classes: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
  paid: { label: 'Pago', classes: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
  overdue: { label: 'Atrasado', classes: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
  cancelled: { label: 'Cancelado', classes: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  exempt: { label: 'Isento', classes: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
}

export function MonthlyFeeStatus({ status, className }: MonthlyFeeStatusProps) {
  const v = variants[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        v.classes,
        className
      )}
    >
      {v.label}
    </span>
  )
}

export const statusOptions: { value: Status | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Pago' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'exempt', label: 'Isento' },
]
