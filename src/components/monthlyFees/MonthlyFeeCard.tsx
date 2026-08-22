import { useNavigate } from 'react-router-dom'
import { MonthlyFeeStatus } from './MonthlyFeeStatus'
import { cn } from '../../utils/cn'
import type { MonthlyFee } from '../../types/monthlyFee'

interface MonthlyFeeCardProps {
  fee: MonthlyFee
  onCancel: (fee: MonthlyFee) => void
  onExempt: (fee: MonthlyFee) => void
  onEdit: (fee: MonthlyFee) => void
  onPay: (fee: MonthlyFee) => void
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'MarÃ§o', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function MonthlyFeeCard({ fee, onCancel, onExempt, onEdit, onPay }: MonthlyFeeCardProps) {
  const navigate = useNavigate()
  const canCancel = fee.status !== 'paid' && fee.status !== 'cancelled'
  const canPay = fee.status === 'pending' || fee.status === 'overdue'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(`/mensalidades/${fee.id}`)}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <span className="h-10 w-10 rounded-full bg-primary-soft text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {initialsOf(fee.passengerName)}
          </span>
          <span className="min-w-0">
            <b className="block text-sm font-semibold text-text truncate">{fee.passengerName}</b>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {monthNames[fee.month - 1]}/{fee.year} Â· vence {fee.dueDate}
            </span>
          </span>
        </button>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tracking-tight text-text tabular-nums">
            R$ {fee.amount.toFixed(2).replace('.', ',')}
          </p>
          <MonthlyFeeStatus status={fee.status} />
        </div>
      </div>

      {canPay ? (
        <div className={cn('flex gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800')}>
          <button
            onClick={() => onPay(fee)}
            className="flex-1 h-10 rounded-full bg-primary text-white text-[13px] font-semibold shadow-md shadow-primary/30 hover:bg-primary-light transition-colors"
          >
            Registrar pagamento
          </button>
          <button
            onClick={() => onExempt(fee)}
            className="h-10 px-4 rounded-full bg-primary-soft text-primary text-[13px] font-semibold hover:brightness-95 transition-all"
          >
            Isentar
          </button>
          <button
            onClick={() => onEdit(fee)}
            aria-label="Editar"
            title="Editar"
            className="h-10 w-10 rounded-full bg-primary-soft text-primary font-semibold hover:brightness-95 transition-all shrink-0"
          >
            âœŽ
          </button>
        </div>
      ) : (
        canCancel && (
          <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => onCancel(fee)}
              className="h-9 px-4 rounded-full bg-error-soft text-error text-[13px] font-semibold hover:brightness-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => onEdit(fee)}
              className="h-9 px-4 rounded-full bg-primary-soft text-primary text-[13px] font-semibold hover:brightness-95 transition-all"
            >
              Editar
            </button>
          </div>
        )
      )}
    </div>
  )
}