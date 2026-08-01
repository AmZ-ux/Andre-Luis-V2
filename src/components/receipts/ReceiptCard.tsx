import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ReceiptStatus } from './ReceiptStatus'
import { ReceiptPreview } from './ReceiptPreview'
import { Eye, Upload, Calendar, DollarSign } from 'lucide-react'
import type { Receipt } from '../../types/receipt'

interface ReceiptCardProps {
  receipt: Receipt
  index: number
  onReplace?: (receipt: Receipt) => void
}

const monthNames = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export function ReceiptCard({ receipt, index, onReplace }: ReceiptCardProps) {
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ReceiptPreview
            fileData={receipt.fileData}
            fileType={receipt.fileType}
            fileName={receipt.fileName}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text truncate">{receipt.passengerName}</p>
            <p className="text-xs text-gray-400 truncate">{receipt.fileName}</p>
          </div>
        </div>
        <ReceiptStatus status={receipt.status} />
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {monthNames[receipt.month - 1]} {receipt.year}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          R$ {receipt.amount.toFixed(2).replace('.', ',')}
        </span>
      </div>

      <p className="text-xs text-gray-400">Enviado em {receipt.createdAt}</p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => navigate(`/comprovantes/${receipt.id}`)}
          className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5 text-sm font-medium text-text hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> Visualizar
        </button>
        {onReplace && receipt.status === 'awaiting' && (
          <button
            onClick={() => onReplace(receipt)}
            className="h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5 text-sm font-medium text-text hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Substituir comprovante"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
