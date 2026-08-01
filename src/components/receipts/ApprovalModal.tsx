import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { ReceiptPreview } from './ReceiptPreview'
import type { Receipt } from '../../types/receipt'

interface ApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (notes: string) => Promise<void>
  receipt: Receipt | null
}

export function ApprovalModal({ isOpen, onClose, onConfirm, receipt }: ApprovalModalProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await onConfirm(notes)
      setNotes('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setNotes('')
    onClose()
  }

  if (!receipt) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Aprovar Comprovante">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
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

        <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-4 border border-yellow-100 dark:border-yellow-900/20">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Ao aprovar, a mensalidade será automaticamente marcada como <strong>Paga</strong>.
          </p>
        </div>

        <Textarea
          label="Observação (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Adicione uma observação..."
          rows={3}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Cancelar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Confirmar Aprovação
          </Button>
        </div>
      </div>
    </Modal>
  )
}
