import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'
import type { FinancialSummary as FinancialSummaryType } from '../../types/dashboard'

interface FinancialSummaryProps {
  data: FinancialSummaryType
}

export function FinancialSummary({ data }: FinancialSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white p-6 sm:p-8"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <p className="text-sm font-medium text-white/80 mb-1">
          Resumo Financeiro • {data.month}
        </p>
        <p className="text-3xl sm:text-4xl font-bold tracking-tight">
          R$ {data.receivedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-white/70 mt-1">
          Receita Prevista: R$ {data.expectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wide">Previsto</p>
            <p className="text-sm sm:text-base font-bold mt-1">
              R$ {data.expectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wide">Pendente</p>
            <p className="text-sm sm:text-base font-bold mt-1">
              R$ {data.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wide">Atrasado</p>
            <p className="text-sm sm:text-base font-bold mt-1">
              R$ {data.overdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-white/80">Recebido</span>
            <span className="font-semibold">{data.receivedPercentage}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000 ease-out',
                data.receivedPercentage > 80 ? 'bg-success' : data.receivedPercentage > 50 ? 'bg-warning' : 'bg-error'
              )}
              style={{ width: `${data.receivedPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
