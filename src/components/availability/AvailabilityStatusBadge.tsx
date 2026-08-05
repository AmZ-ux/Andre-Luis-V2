import { cn } from '../../utils/cn'
import type { AvailabilityStatus } from '../../types/availability'

interface AvailabilityStatusBadgeProps {
  status: AvailabilityStatus
  className?: string
}

const variants: Record<AvailabilityStatus, { label: string; classes: string }> = {
  scheduled: { label: 'Agendado', classes: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
  active: { label: 'Em andamento', classes: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
  finished: { label: 'Finalizado', classes: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  cancelled: { label: 'Cancelado', classes: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
}

export function AvailabilityStatusBadge({ status, className }: AvailabilityStatusBadgeProps) {
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

// oxlint-disable-next-line react/only-export-components
export const availabilityStatusOptions: { value: AvailabilityStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'active', label: 'Em andamento' },
  { value: 'finished', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
]
