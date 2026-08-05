import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, Pencil, XCircle, CheckCircle } from 'lucide-react'
import { MonthlyFeeStatus } from './MonthlyFeeStatus'
import { cn } from '../../utils/cn'
import { useIsMobile } from '../../hooks/useBreakpoint'
import type { MonthlyFee, MonthlyFeeSort } from '../../types/monthlyFee'

interface MonthlyFeeTableProps {
  fees: MonthlyFee[]
  sort: MonthlyFeeSort
  onSort: (field: MonthlyFeeSort['field']) => void
  onCancel: (fee: MonthlyFee) => void
  onExempt: (fee: MonthlyFee) => void
  onEdit: (fee: MonthlyFee) => void
}

interface SortHeaderProps {
  label: string
  field: MonthlyFeeSort['field']
  current: MonthlyFeeSort
  onClick: (field: MonthlyFeeSort['field']) => void
}

function SortHeader({ label, field, current, onClick }: SortHeaderProps) {
  const active = current.field === field
  return (
    <button
      onClick={() => onClick(field)}
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'text-text' : 'text-gray-500 dark:text-gray-400 hover:text-text'
      )}
    >
      {label}
      <span className="inline-flex flex-col -space-y-1">
        <ChevronUp className={cn('h-3 w-3', active && current.direction === 'asc' ? 'text-primary' : 'text-gray-300')} />
        <ChevronDown className={cn('h-3 w-3', active && current.direction === 'desc' ? 'text-primary' : 'text-gray-300')} />
      </span>
    </button>
  )
}

const actionButtonClass =
  'h-11 w-11 rounded-lg flex items-center justify-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800'

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const paymentLabels: Record<string, string> = {
  pix: 'PIX', cash: 'Dinheiro', transfer: 'Transferência', card: 'Cartão',
}

export function MonthlyFeeTable({
  fees,
  sort,
  onSort,
  onCancel,
  onExempt,
  onEdit,
}: MonthlyFeeTableProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  if (fees.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-400">Nenhuma mensalidade encontrada</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {fees.map((fee, i) => {
          const canCancel = fee.status !== 'paid' && fee.status !== 'cancelled'
          const canExempt = fee.status !== 'paid' && fee.status !== 'exempt'

          return (
            <motion.div
              key={fee.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => navigate(`/mensalidades/${fee.id}`)}
                  className="text-base font-semibold text-text hover:text-primary transition-colors text-left min-w-0"
                >
                  {fee.passengerName}
                </button>
                <MonthlyFeeStatus status={fee.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>
                  <p className="text-gray-400">Competência</p>
                  <p className="text-sm font-semibold text-text">
                    {monthNames[fee.month - 1]} {fee.year}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Valor</p>
                  <p className="text-sm font-bold text-text">
                    R$ {fee.amount.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Vencimento</p>
                  <p className="text-sm text-text">{fee.dueDate}</p>
                </div>
                <div>
                  <p className="text-gray-400">Pagamento</p>
                  <p className="text-sm text-text">{fee.payment?.paymentDate || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400">Forma de pagamento</p>
                  <p className="text-sm text-text">
                    {fee.payment ? paymentLabels[fee.payment.paymentMethod] || fee.payment.paymentMethod : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                {canExempt && (
                  <button
                    onClick={() => onExempt(fee)}
                    className={cn(actionButtonClass, 'text-blue-500 hover:text-blue-600')}
                    aria-label="Isentar"
                    title="Isentar"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => onCancel(fee)}
                    className={cn(actionButtonClass, 'text-gray-400 hover:text-error')}
                    aria-label="Cancelar"
                    title="Cancelar"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(fee)}
                  className={cn(actionButtonClass, 'text-gray-400 hover:text-primary')}
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-4 py-3 text-left">
              <SortHeader label="Passageiro" field="passengerName" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">Mês</th>
            <th className="px-4 py-3 text-right">
              <SortHeader label="Valor" field="amount" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Vencimento" field="dueDay" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Pagamento" field="paymentDate" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-center">Forma</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {fees.map((fee) => {
            const canCancel = fee.status !== 'paid' && fee.status !== 'cancelled'
            const canExempt = fee.status !== 'paid' && fee.status !== 'exempt'

            return (
              <tr
                key={fee.id}
                className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/mensalidades/${fee.id}`)}
                    className="text-sm font-medium text-text hover:text-primary transition-colors"
                  >
                    {fee.passengerName}
                  </button>
                </td>
                <td className="px-4 py-3 text-center text-sm text-text">
                  {monthNames[fee.month - 1]}/{fee.year}
                </td>
                <td className="px-4 py-3 text-right text-sm text-text font-medium">
                  R$ {fee.amount.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3 text-center text-sm text-text">{fee.dueDate}</td>
                <td className="px-4 py-3 text-center text-sm text-text">
                  {fee.payment?.paymentDate || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <MonthlyFeeStatus status={fee.status} />
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-500">
                  {fee.payment ? paymentLabels[fee.payment.paymentMethod] || fee.payment.paymentMethod : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {canExempt && (
                      <button
                        onClick={() => onExempt(fee)}
                        className={cn(actionButtonClass, 'text-blue-500 hover:text-blue-600')}
                        aria-label="Isentar"
                        title="Isentar"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {canCancel && (
                      <button
                        onClick={() => onCancel(fee)}
                        className={cn(actionButtonClass, 'text-gray-400 hover:text-error')}
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(fee)}
                      className={cn(actionButtonClass, 'text-gray-400 hover:text-primary')}
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
