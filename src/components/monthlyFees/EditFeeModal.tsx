import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { monthlyRules } from '../../services/monthlyRules'
import type { MonthlyFee } from '../../types/monthlyFee'

interface EditFeeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { dueDay: string; notes: string }) => Promise<void>
  fee: MonthlyFee | null
}

export function EditFeeModal({ isOpen, onClose, onConfirm, fee }: EditFeeModalProps) {
  const [dueDay, setDueDay] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fee) {
      setDueDay(String(fee.dueDay))
      setNotes(fee.notes || '')
      setErrors({})
    }
  }, [fee])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    const dueErr = monthlyRules.validateDueDay(dueDay)
    if (dueErr) errs.dueDay = dueErr
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await onConfirm({ dueDay, notes })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!fee) return null

  const formattedAmount = `R$ ${fee.amount.toFixed(2).replace('.', ',')}`

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Mensalidade">
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <p className="text-sm font-medium text-text">{fee.passengerName}</p>
          <p className="text-xs text-gray-400 mt-1">
            {String(fee.month).padStart(2, '0')}/{fee.year}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Valor (R$)</label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-text">
            {formattedAmount}
          </div>
          <p className="text-xs text-gray-400 mt-1">Valor definido pela rota</p>
        </div>

        <Input
          label="Dia de vencimento"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          error={errors.dueDay}
          type="number"
          min={1}
          max={31}
          placeholder="1-31"
        />
        <Textarea
          label="Observação"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
