import type { PassengerStatus } from '../../types/passenger'
import { cn } from '../../utils/cn'

interface PassengerStatusBadgeProps {
  status: PassengerStatus
  className?: string
}

const config: Record<PassengerStatus, { label: string; classes: string; dot: string }> = {
  active: { label: 'Ativo', classes: 'bg-success-soft text-success border-success/20', dot: 'bg-success' },
  inactive: { label: 'Inativo', classes: 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700', dot: 'bg-gray-400' },
  vacation: { label: 'Férias', classes: 'bg-warning-soft text-warning border-warning/20', dot: 'bg-warning' },
  blocked: { label: 'Bloqueado', classes: 'bg-error-soft text-error border-error/20', dot: 'bg-error' },
}

export function PassengerStatusBadge({ status, className }: PassengerStatusBadgeProps) {
  const c = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap',
        c.classes,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} aria-hidden="true" />
      {c.label}
    </span>
  )
}
