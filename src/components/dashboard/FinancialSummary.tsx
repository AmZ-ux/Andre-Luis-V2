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

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 mt-7 pt-6 border-t border-white/15">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt className="text-[11px] uppercase tracking-[0.12em] text-white/60 font-semibold">
                {m.label}
              </dt>
              <dd className="text-lg sm:text-xl font-bold mt-1.5 tabular-nums whitespace-nowrap">
                R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-center gap-4 px-6 sm:px-8 pb-6">
        <div
          className="h-2 flex-1 flex gap-0.5 rounded-full overflow-hidden bg-white/10"
          role="img"
          aria-label={`${data.receivedPercentage}% recebido`}
        >
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