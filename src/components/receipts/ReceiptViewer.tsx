import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Receipt } from '../../types/receipt'

interface ReceiptViewerProps {
  receipt: Receipt
  onClose: () => void
}

export function ReceiptViewer({ receipt, onClose }: ReceiptViewerProps) {
  const isImage = receipt.fileType.startsWith('image/')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text truncate">{receipt.fileName}</h2>
            <p className="text-xs text-gray-400">{receipt.passengerName}</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
          {isImage ? (
            <img
              src={receipt.fileData}
              alt={receipt.fileName}
              className="max-w-full max-h-[70vh] rounded-xl object-contain shadow-sm"
            />
          ) : (
            <iframe
              src={receipt.fileData}
              title={receipt.fileName}
              className="w-full h-[70vh] rounded-xl border border-gray-200 dark:border-gray-700"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
