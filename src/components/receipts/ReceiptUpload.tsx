import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload, X, FileImage, FileText, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../utils/cn'
import { receiptValidation } from '../../services/receiptValidation'
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../../types/receipt'

interface ReceiptUploadProps {
  onFileSelect: (file: File) => void
  onRemove: () => void
  selectedFile: File | null
  previewData: string | null
  error?: string
}

export function ReceiptUpload({ onFileSelect, onRemove, selectedFile, previewData, error }: ReceiptUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    const result = receiptValidation.validateFile(file)
    if (!result.valid) {
      setValidationError(result.error || 'Arquivo inválido')
      return
    }
    setValidationError(null)
    onFileSelect(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const displayError = error || validationError

  return (
    <div className="space-y-3">
      {!selectedFile ? (
        <label
          htmlFor="receipt-file-input"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all select-none',
            'hover:border-primary hover:bg-primary/5',
            dragOver ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-gray-300 dark:border-gray-600',
            displayError && 'border-error bg-error/5'
          )}
        >
          <input
            ref={inputRef}
            id="receipt-file-input"
            type="file"
            accept={ALLOWED_FILE_TYPES.join(',')}
            onChange={handleChange}
            className="sr-only"
            aria-label="Selecionar arquivo"
          />
          <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Upload className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-text mb-1">
            Clique para selecionar ou arraste o arquivo
          </p>
          <p className="text-xs text-gray-400">
            JPG, PNG ou PDF — máximo {MAX_FILE_SIZE / 1024 / 1024}MB
          </p>
        </label>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <button
            onClick={onRemove}
            className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-white dark:bg-gray-700 shadow-sm border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            aria-label="Remover arquivo"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>

          <div className="flex items-center gap-4">
            {previewData && selectedFile.type.startsWith('image/') ? (
              <img
                src={previewData}
                alt="Preview"
                className="h-16 w-16 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {selectedFile.type === 'application/pdf' ? (
                  <FileText className="h-6 w-6 text-gray-400" />
                ) : (
                  <FileImage className="h-6 w-6 text-gray-400" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">{receiptValidation.formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {displayError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-sm text-error flex items-center gap-1.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {displayError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
