import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { MonthlyFee } from '../../types/monthlyFee'

interface ExemptionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  fee: MonthlyFee | null
}

export function ExemptionModal({ isOpen, onClose, onConfirm, fee }: ExemptionModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Informe o motivo da isenção')
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

  if (!fee) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Isentar Mensalidade">
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-900/20">
          <p className="text-sm font-medium text-text">{fee.passengerName}</p>
          <p className="text-xs text-gray-500 mt-1">
            R$ {fee.amount.toFixed(2).replace('.', ',')} — {String(fee.month).padStart(2, '0')}/{fee.year}
          </p>
        </div>

        <Textarea
          label="Motivo da isenção"
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError('') }}
          error={error}
          placeholder="Descreva o motivo..."
          rows={3}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={handleClose}>
            Voltar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Confirmar Isenção
          </Button>
        </div>
      </div>
    </Modal>
  )
}
