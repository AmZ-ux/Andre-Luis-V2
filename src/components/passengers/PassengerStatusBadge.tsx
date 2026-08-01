import type { PassengerStatus } from '../../types/passenger'
import { cn } from '../../utils/cn'

interface PassengerStatusBadgeProps {
  status: PassengerStatus
  className?: string
}

const config: Record<PassengerStatus, { label: string; classes: string }> = {
  active: { label: 'Ativo', classes: 'bg-success/10 text-success' },
  inactive: { label: 'Inativo', classes: 'bg-gray-100 dark:bg-gray-800 text-gray-500' },
  vacation: { label: 'Férias', classes: 'bg-warning/10 text-warning' },
  blocked: { label: 'Bloqueado', classes: 'bg-error/10 text-error' },
}

export function PassengerStatusBadge({ status, className }: PassengerStatusBadgeProps) {
  const c = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        c.classes,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'active' ? 'bg-success' : status === 'inactive' ? 'bg-gray-400' : status === 'vacation' ? 'bg-warning' : 'bg-error')} />
      {c.label}
    </span>
  )
}
