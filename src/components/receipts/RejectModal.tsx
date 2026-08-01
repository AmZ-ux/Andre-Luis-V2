import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { ReceiptPreview } from './ReceiptPreview'
import type { Receipt } from '../../types/receipt'

interface RejectModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  receipt: Receipt | null
}

export function RejectModal({ isOpen, onClose, onConfirm, receipt }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Informe o motivo da rejeição')
      return
    }
    setLoading(true)
    try {
      await onConfirm(reason.trim())
      setReason('')
      setError('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setReason('')
    setError('')
    onClose()
  }

  if (!receipt) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Rejeitar Comprovante">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
          <ReceiptPreview
            fileData={receipt.fileData}
            fileType={receipt.fileType}
            fileName={receipt.fileName}
            size="sm"
          />
          <div>
            <p className="text-sm font-medium text-text">{receipt.passengerName}</p>
            <p className="text-xs text-gray-500">
              R$ {receipt.amount.toFixed(2).replace('.', ',')} — {String(receipt.month).padStart(2, '0')}/{receipt.year}
            </p>
          </div>
        </div>

        <Textarea
          label="Motivo da rejeição"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError('') }}
          error={error}
          placeholder="Descreva o motivo..."
          rows={4}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="danger" fullWidth loading={loading} onClick={handleSubmit}>
            Rejeitar Comprovante
          </Button>
        </div>
      </div>
    </Modal>
  )
}
