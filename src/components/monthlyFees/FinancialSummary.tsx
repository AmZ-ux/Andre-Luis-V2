import { motion } from 'framer-motion'
import { cn } from '../../utils/cn'
import type { MonthlyFee } from '../../types/monthlyFee'

interface FinancialSummaryProps {
  fees: MonthlyFee[]
}

interface SummaryItem {
  label: string
  value: string
  subValue?: string
  variant: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
}

export function FinancialSummary({ fees }: FinancialSummaryProps) {
  const totalPrevisto = fees.reduce((s, f) => s + f.amount, 0)
  const totalPago = fees.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
  const totalPendente = fees.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0)
  const totalAtrasado = fees.filter((f) => f.status === 'overdue').reduce((s, f) => s + f.amount, 0)

  const qtdPaga = fees.filter((f) => f.status === 'paid').length
  const qtdPendente = fees.filter((f) => f.status === 'pending').length
  const qtdAtrasada = fees.filter((f) => f.status === 'overdue').length

  const items: SummaryItem[] = [
    { label: 'Previsto', value: `R$ ${totalPrevisto.toFixed(2).replace('.', ',')}`, variant: 'primary' },
    { label: 'Recebido', value: `R$ ${totalPago.toFixed(2).replace('.', ',')}`, subValue: `${qtdPaga} pagas`, variant: 'success' },
    { label: 'Pendente', value: `R$ ${totalPendente.toFixed(2).replace('.', ',')}`, subValue: `${qtdPendente} pendentes`, variant: 'warning' },
    { label: 'Atrasado', value: `R$ ${totalAtrasado.toFixed(2).replace('.', ',')}`, subValue: `${qtdAtrasada} atrasadas`, variant: 'error' },
  ]

  const variantStyles = {
    primary: 'from-primary/5 to-primary/10 border-primary/20',
    success: 'from-success/5 to-success/10 border-success/20',
    warning: 'from-warning/5 to-warning/10 border-warning/20',
    error: 'from-error/5 to-error/10 border-error/20',
    neutral: 'from-gray-50 to-gray-100 border-gray-200',
  }

  const iconColors = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    neutral: 'text-gray-400',
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className={cn(
            'rounded-2xl border bg-gradient-to-br p-4 sm:p-5',
            variantStyles[item.variant]
          )}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className={cn('text-lg sm:text-2xl font-bold mt-1', iconColors[item.variant])}>
            {item.value}
          </p>
          {item.subValue && (
            <p className="text-xs text-gray-400 mt-0.5">{item.subValue}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}
