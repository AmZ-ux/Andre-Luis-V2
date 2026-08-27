import { useNavigate } from 'react-router-dom'
import { MonthlyFeeStatus } from './MonthlyFeeStatus'
import type { MonthlyFee } from '../../types/monthlyFee'

interface MonthlyFeeCardProps {
  fee: MonthlyFee
  onCancel: (fee: MonthlyFee) => void
  onExempt: (fee: MonthlyFee) => void
  onEdit: (fee: MonthlyFee) => void
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
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

export function MonthlyFeeCard({ fee, onCancel, onExempt, onEdit }: MonthlyFeeCardProps) {
  const navigate = useNavigate()
  const canCancel = fee.status !== 'paid' && fee.status !== 'cancelled'

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
              {monthNames[fee.month - 1]}/{fee.year} · vence {fee.dueDate}
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

      {canCancel ? (
        <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onExempt(fee)}
            className="h-9 px-4 rounded-full bg-primary-soft text-primary text-[13px] font-semibold hover:brightness-95 transition-all"
          >
            Isentar
          </button>
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
      ) : (
        <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onEdit(fee)}
            className="h-9 px-4 rounded-full bg-primary-soft text-primary text-[13px] font-semibold hover:brightness-95 transition-all"
          >
            Editar
          </button>
        </div>
      )}
    </div>
  )
}