import { cn } from '../../utils/cn'
import type { Period } from '../../types/dashboard'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
}

const periods: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
]

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
            value === p.value
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-text'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
