import { motion } from 'framer-motion'
import { ReceiptStatus } from './ReceiptStatus'
import { ReceiptPreview } from './ReceiptPreview'
import { Eye, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useIsMobile } from '../../hooks/useBreakpoint'
import type { Receipt, ReceiptSort } from '../../types/receipt'

interface ReceiptTableProps {
  receipts: Receipt[]
  sort: ReceiptSort
  onSort: (field: ReceiptSort['field']) => void
  onView: (receipt: Receipt) => void
}

interface SortHeaderProps {
  label: string
  field: ReceiptSort['field']
  current: ReceiptSort
  onClick: (field: ReceiptSort['field']) => void
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

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function ReceiptTable({ receipts, sort, onSort, onView }: ReceiptTableProps) {
  const isMobile = useIsMobile()

  if (receipts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-400">Nenhum comprovante encontrado</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {receipts.map((receipt, i) => (
          <motion.div
            key={receipt.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <ReceiptPreview
                  fileData={receipt.fileData}
                  fileType={receipt.fileType}
                  fileName={receipt.fileName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{receipt.passengerName}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{receipt.fileName}</p>
                </div>
              </div>
              <ReceiptStatus status={receipt.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div>
                <p className="text-gray-400">Competência</p>
                <p className="text-sm text-text">
                  {monthNames[receipt.month - 1]} {receipt.year}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Valor</p>
                <p className="text-sm font-bold text-text">
                  R$ {receipt.amount.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400">Data de envio</p>
                <p className="text-sm text-text">{receipt.createdAt}</p>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => onView(receipt)}
                className="h-11 w-11 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary transition-all"
                aria-label="Visualizar"
                title="Visualizar"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[680px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-4 py-3 text-left">Arquivo</th>
            <th className="px-4 py-3 text-left">
              <SortHeader label="Passageiro" field="passengerName" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">Competência</th>
            <th className="px-4 py-3 text-right">
              <SortHeader label="Valor" field="amount" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Data Envio" field="createdAt" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Status" field="status" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr
              key={receipt.id}
              className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
            >
              <td className="px-4 py-3">
                <ReceiptPreview
                  fileData={receipt.fileData}
                  fileType={receipt.fileType}
                  fileName={receipt.fileName}
                  size="sm"
                />
              </td>
              <td className="px-4 py-3 text-sm font-medium text-text">{receipt.passengerName}</td>
              <td className="px-4 py-3 text-center text-sm text-text">
                {monthNames[receipt.month - 1]} {receipt.year}
              </td>
              <td className="px-4 py-3 text-right text-sm text-text">
                R$ {receipt.amount.toFixed(2).replace('.', ',')}
              </td>
              <td className="px-4 py-3 text-center text-sm text-text">{receipt.createdAt}</td>
              <td className="px-4 py-3 text-center">
                <ReceiptStatus status={receipt.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onView(receipt)}
                  className="h-11 w-11 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary transition-all"
                  aria-label="Visualizar"
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
