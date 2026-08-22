import { cn } from '../../utils/cn'
import type { MonthlyFeeStatus as Status } from '../../types/monthlyFee'

interface MonthlyFeeStatusProps {
  status: Status
  className?: string
}

const variants: Record<Status, { label: string; classes: string; dot: string }> = {
  pending: { label: 'Pendente', classes: 'bg-warning-soft text-warning border-warning/20', dot: 'bg-warning' },
  paid: { label: 'Pago', classes: 'bg-success-soft text-success border-success/20', dot: 'bg-success' },
  overdue: { label: 'Atrasado', classes: 'bg-error-soft text-error border-error/20', dot: 'bg-error' },
  cancelled: { label: 'Cancelado', classes: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700', dot: 'bg-gray-400' },
  exempt: { label: 'Isento', classes: 'bg-primary-soft text-primary border-primary/20', dot: 'bg-primary' },
}

export function MonthlyFeeStatus({ status, className }: MonthlyFeeStatusProps) {
  const v = variants[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap',
        v.classes,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', v.dot)} aria-hidden="true" />
      {v.label}
    </span>
  )
}

// oxlint-disable-next-line react/only-export-components
export const statusOptions: { value: Status | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Pago' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'exempt', label: 'Isento' },
]