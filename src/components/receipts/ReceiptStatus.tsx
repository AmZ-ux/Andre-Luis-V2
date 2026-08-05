import { cn } from '../../utils/cn'
import type { ReceiptStatus as Status } from '../../types/receipt'

interface ReceiptStatusProps {
  status: Status
  className?: string
}

const variants: Record<Status, { label: string; classes: string }> = {
  awaiting: { label: 'Aguardando', classes: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
  approved: { label: 'Aprovado', classes: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
  rejected: { label: 'Rejeitado', classes: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
  cancelled: { label: 'Cancelado', classes: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
}

export function ReceiptStatus({ status, className }: ReceiptStatusProps) {
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
export const receiptStatusOptions: { value: Status | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'awaiting', label: 'Aguardando' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Rejeitado' },
  { value: 'cancelled', label: 'Cancelado' },
]
