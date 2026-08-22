import { cn } from '../../utils/cn'
import type { FinancialSummary as FinancialSummaryType } from '../../types/dashboard'

interface FinancialSummaryProps {
  data: FinancialSummaryType
}

const metricStyles: Record<string, { cell: string; label: string; value: string }> = {
  Previsto: {
    cell: 'bg-white/10',
    label: 'text-white/60',
    value: 'text-white',
  },
  Pendente: {
    cell: 'bg-amber-400/20',
    label: 'text-amber-200/90',
    value: 'text-amber-200',
  },
  Atrasado: {
    cell: 'bg-red-500/25',
    label: 'text-red-200/90',
    value: 'text-red-200',
  },
  Recebido: {
    cell: 'bg-emerald-400/20',
    label: 'text-emerald-200/90',
    value: 'text-emerald-200',
  },
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  const metrics = [
    { label: 'Previsto', value: data.expectedRevenue },
    { label: 'Pendente', value: data.pendingAmount },
    { label: 'Atrasado', value: data.overdueAmount },
    { label: 'Recebido', value: data.receivedRevenue },
  ]

  const base = Math.max(1, data.expectedRevenue)
  const receivedPct = Math.min(100, Math.max(0, data.receivedPercentage))
  const pendingPct = Math.min(100 - receivedPct, (data.pendingAmount / base) * 100)
  const overduePct = Math.min(100 - receivedPct - pendingPct, (data.overdueAmount / base) * 100)
  const restPct = Math.max(0, 100 - receivedPct - pendingPct - overduePct)

  return (
    <section className="rounded-3xl bg-primary-dark text-white overflow-hidden shadow-pop">
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">
          Resumo financeiro · {data.month}
        </p>
        <p className="text-4xl sm:text-5xl font-bold tracking-tight mt-2.5">
          R$ {data.receivedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-white/70 mt-2">
          de R$ {data.expectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previstos
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 rounded-2xl overflow-hidden mt-6 p-1 bg-white/10">
          {metrics.map((m) => {
            const s = metricStyles[m.label]
            return (
              <div key={m.label} className={cn('rounded-xl px-4 py-3.5', s.cell)}>
                <p className={cn('text-[10px] uppercase tracking-wider font-semibold', s.label)}>
                  {m.label}
                </p>
                <p className={cn('text-base sm:text-lg font-bold mt-1 tabular-nums', s.value)}>
                  R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 sm:px-8 pb-6">
        <div className="h-2 flex-1 flex gap-0.5 rounded-full overflow-hidden bg-white/10" role="img" aria-label={`${data.receivedPercentage}% recebido`}>
          {receivedPct > 0 && (
            <span className="h-full bg-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${receivedPct}%` }} />
          )}
          {pendingPct > 0 && (
            <span className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${pendingPct}%` }} />
          )}
          {overduePct > 0 && (
            <span className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${overduePct}%` }} />
          )}
          {restPct > 0 && (
            <span className="h-full bg-white/15 transition-all duration-1000" style={{ width: `${restPct}%` }} />
          )}
        </div>
        <p className="text-sm font-bold tabular-nums shrink-0">{data.receivedPercentage}% recebido</p>
      </div>
    </section>
  )
}