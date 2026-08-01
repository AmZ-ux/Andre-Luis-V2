import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MonthlyFeeStatus } from './MonthlyFeeStatus'
import { DollarSign, XCircle, CheckCircle, Pencil, Calendar } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { MonthlyFee } from '../../types/monthlyFee'

interface MonthlyFeeCardProps {
  fee: MonthlyFee
  onPay: (fee: MonthlyFee) => void
  onCancel: (fee: MonthlyFee) => void
  onExempt: (fee: MonthlyFee) => void
  onEdit: (fee: MonthlyFee) => void
  index: number
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function MonthlyFeeCard({ fee, onPay, onCancel, onExempt, onEdit, index }: MonthlyFeeCardProps) {
  const navigate = useNavigate()
  const canPay = fee.status === 'pending' || fee.status === 'overdue'
  const canCancel = fee.status !== 'paid' && fee.status !== 'cancelled'
  const canExempt = fee.status !== 'paid' && fee.status !== 'exempt'

  const btnClass =
    'h-11 w-11 rounded-xl flex items-center justify-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <button
            onClick={() => navigate(`/mensalidades/${fee.id}`)}
            className="text-sm font-semibold text-text hover:text-primary transition-colors"
          >
            {fee.passengerName}
          </button>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {monthNames[fee.month - 1]} {fee.year}
          </p>
        </div>
        <MonthlyFeeStatus status={fee.status} />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-text">
            R$ {fee.amount.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-gray-400">Vence {fee.dueDate}</p>
          {fee.payment && (
            <p className="text-xs text-success">Pago em {fee.payment.paymentDate}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canPay && (
            <button
              onClick={() => onPay(fee)}
              className={cn(btnClass, 'text-success')}
              aria-label="Registrar pagamento"
              title="Registrar pagamento"
            >
              <DollarSign className="h-4 w-4" />
            </button>
          )}
          {canExempt && (
            <button
              onClick={() => onExempt(fee)}
              className={cn(btnClass, 'text-blue-500')}
              aria-label="Isentar"
              title="Isentar"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(fee)}
              className={cn(btnClass, 'text-gray-400 hover:text-error')}
              aria-label="Cancelar"
              title="Cancelar"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(fee)}
            className={cn(btnClass, 'text-gray-400 hover:text-primary')}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
