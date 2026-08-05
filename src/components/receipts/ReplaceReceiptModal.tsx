import { useState, useRef, type ChangeEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { receiptValidation } from '../../services/receiptValidation'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../../types/receipt'
import type { Receipt } from '../../types/receipt'

interface ReplaceReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (file: File) => Promise<void>
  receipt: Receipt | null
}

export function ReplaceReceiptModal({ isOpen, onClose, onConfirm, receipt }: ReplaceReceiptModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = (file: File) => {
    const result = receiptValidation.validateFile(file)
    if (!result.valid) {
      setError(result.error || 'Arquivo inválido')
      return
    }
    setError(null)
    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setPreviewData(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreviewData(null)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setPreviewData(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Selecione um arquivo')
      return
    }
    setLoading(true)
    try {
      await onConfirm(selectedFile)
      handleRemove()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    handleRemove()
    onClose()
  }

  if (!receipt) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Substituir Comprovante">
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <p className="text-sm font-medium text-text">{receipt.passengerName}</p>
          <p className="text-xs text-gray-400 mt-1">
            R$ {receipt.amount.toFixed(2).replace('.', ',')} — {String(receipt.month).padStart(2, '0')}/{receipt.year}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_FILE_TYPES.join(',')}
          onChange={handleChange}
          className="hidden"
          aria-label="Selecionar arquivo"
        />

        {!selectedFile ? (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-text">Clique para selecionar novo arquivo</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG ou PDF — máximo {MAX_FILE_SIZE / 1024 / 1024}MB</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <button
              onClick={handleRemove}
              className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white dark:bg-gray-700 shadow-sm border flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600"
              aria-label="Remover"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-4">
              {previewData ? (
                <img src={previewData} alt="Preview" className="h-16 w-16 rounded-xl object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{receiptValidation.formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-error flex items-center gap-1.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Cancelar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit} disabled={!selectedFile}>
            Substituir
          </Button>
        </div>
      </div>
    </Modal>
  )
}
