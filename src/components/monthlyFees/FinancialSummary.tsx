import { cn } from '../../utils/cn'
import type { MonthlyFee, MonthlyFeeSummary } from '../../types/monthlyFee'

interface FinancialSummaryProps {
  fees: MonthlyFee[]
  summary?: MonthlyFeeSummary | null
}

interface SummaryItem {
  label: string
  value: string
  subValue?: string
  variant: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
}

export function FinancialSummary({ fees, summary }: FinancialSummaryProps) {
  const computed = {
    totalPrevisto: fees.reduce((s, f) => s + f.amount, 0),
    totalPago: fees.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
    totalPendente: fees.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0),
    totalAtrasado: fees.filter((f) => f.status === 'overdue').reduce((s, f) => s + f.amount, 0),
    qtdPaga: fees.filter((f) => f.status === 'paid').length,
    qtdPendente: fees.filter((f) => f.status === 'pending').length,
    qtdAtrasada: fees.filter((f) => f.status === 'overdue').length,
  }

  const totals = summary
    ? {
        totalPrevisto: summary.expected,
        totalPago: summary.received,
        totalPendente: summary.pending,
        totalAtrasado: summary.overdue,
        qtdPaga: summary.paidCount,
        qtdPendente: summary.pendingCount,
        qtdAtrasada: summary.overdueCount,
      }
    : computed

  const items: SummaryItem[] = [
    { label: 'Previsto', value: `R$ ${totals.totalPrevisto.toFixed(2).replace('.', ',')}`, variant: 'primary' },
    { label: 'Recebido', value: `R$ ${totals.totalPago.toFixed(2).replace('.', ',')}`, subValue: `${totals.qtdPaga} pagas`, variant: 'success' },
    { label: 'Pendente', value: `R$ ${totals.totalPendente.toFixed(2).replace('.', ',')}`, subValue: `${totals.qtdPendente} pendentes`, variant: 'warning' },
    { label: 'Atrasado', value: `R$ ${totals.totalAtrasado.toFixed(2).replace('.', ',')}`, subValue: `${totals.qtdAtrasada} atrasadas`, variant: 'error' },
  ]

  const valueColors = {
    primary: 'text-text',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    neutral: 'text-text',
  }

  const chipStyles: Record<SummaryItem['variant'], string> = {
    primary: 'bg-primary-dark text-white',
    success: 'bg-white dark:bg-gray-900 text-text',
    warning: 'bg-white dark:bg-gray-900 text-text',
    error: 'bg-error-soft text-error',
    neutral: 'bg-white dark:bg-gray-900 text-text',
  }

  const labelStyles: Record<SummaryItem['variant'], string> = {
    primary: 'text-white/70',
    success: 'text-gray-500 dark:text-gray-400',
    warning: 'text-gray-500 dark:text-gray-400',
    error: 'text-error/70',
    neutral: 'text-gray-500 dark:text-gray-400',
  }

  return (
    <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide pb-1 -mb-1">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-2xl px-4 sm:px-5 py-3.5 min-w-[132px] shrink-0 shadow-card',
            chipStyles[item.variant]
          )}
        >
          <p className={cn('text-[10px] font-semibold uppercase tracking-[0.12em]', labelStyles[item.variant])}>
            {item.label}
          </p>
          <p className={cn('text-lg font-bold tracking-tight mt-1 tabular-nums whitespace-nowrap', valueColors[item.variant])}>
            {item.value}
          </p>
          {item.subValue && (
            <p className={cn('text-[11px] mt-0.5', labelStyles[item.variant])}>{item.subValue}</p>
          )}
        </div>
      ))}
    </div>
  )
}