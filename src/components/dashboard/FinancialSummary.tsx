import { cn } from '../../utils/cn'
import type { FinancialSummary as FinancialSummaryType } from '../../types/dashboard'

interface FinancialSummaryProps {
  data: FinancialSummaryType
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  const metrics = [
    { label: 'Previsto', value: data.expectedRevenue },
    { label: 'Pendente', value: data.pendingAmount },
    { label: 'Atrasado', value: data.overdueAmount },
    { label: 'Recebido', value: data.receivedRevenue },
  ]

  return (
    <section className="rounded-3xl bg-primary-dark text-white overflow-hidden shadow-pop">
      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-soft/90">
          Resumo financeiro · {data.month}
        </p>
        <p className="text-4xl sm:text-5xl font-bold tracking-tight mt-2.5">
          R$ {data.receivedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-white/70 mt-2">
          de R$ {data.expectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previstos
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-white/15 rounded-2xl overflow-hidden mt-6 p-1">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                {m.label}
              </p>
              <p className="text-base sm:text-lg font-bold mt-1 tabular-nums">
                R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 px-6 sm:px-8 pb-6">
        <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000 ease-out',
              data.receivedPercentage > 80 ? 'bg-success' : data.receivedPercentage > 50 ? 'bg-warning' : 'bg-error'
            )}
            style={{ width: `${Math.min(100, Math.max(0, data.receivedPercentage))}%` }}
          />
        </div>
        <p className="text-sm font-bold tabular-nums shrink-0">{data.receivedPercentage}% recebido</p>
      </div>
    </section>
  )
}