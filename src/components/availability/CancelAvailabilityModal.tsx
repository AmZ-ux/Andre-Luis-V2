import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { Availability } from '../../types/availability'

interface CancelAvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
  availability: Availability | null
}

export function CancelAvailabilityModal({ isOpen, onClose, onConfirm, availability }: CancelAvailabilityModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Informe o motivo do cancelamento')
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

  if (!availability) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cancelar Período">
      <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-900/20">
          <p className="text-sm font-medium text-text">{availability.passengerName}</p>
          <p className="text-xs text-gray-500 mt-1">
            {availability.startDate} — {availability.endDate}
          </p>
        </div>

        <Textarea
          label="Motivo do cancelamento"
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
          <Button variant="danger" fullWidth loading={loading} onClick={handleSubmit}>
            Confirmar Cancelamento
          </Button>
        </div>
      </div>
    </Modal>
  )
}
