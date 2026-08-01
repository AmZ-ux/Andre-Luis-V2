import { useState } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { AVAILABILITY_TYPES } from '../../types/availability'
import type { AvailabilityFormData } from '../../types/availability'
import { availabilityValidation } from '../../services/availabilityValidation'

interface AvailabilityFormProps {
  onSubmit: (data: AvailabilityFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
  submitLabel?: string
}

export function AvailabilityForm({ onSubmit, onCancel, loading = false, submitLabel = 'Confirmar' }: AvailabilityFormProps) {
  const [type, setType] = useState<string>('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    const dateResult = availabilityValidation.validateDates(startDate, endDate)
    if (!dateResult.valid) {
      errs.dates = dateResult.error || ''
    }
    const reasonResult = availabilityValidation.validateReason(reason)
    if (!reasonResult.valid) {
      errs.reason = reasonResult.error || ''
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    await onSubmit({
      type: type as AvailabilityFormData['type'],
      startDate,
      endDate,
      reason: reason.trim(),
      notes,
    })
    setType('vacation')
    setStartDate('')
    setEndDate('')
    setReason('')
    setNotes('')
    setErrors({})
  }

  return (
    <div className="space-y-4">
      <Select
        label="Tipo"
        options={AVAILABILITY_TYPES}
        value={type}
        onChange={(e) => setType(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Data inicial"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          error={errors.dates}
        />
        <Input
          label="Data final"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <Textarea
        label="Motivo"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
        placeholder="Descreva o motivo..."
        rows={3}
      />

      <Textarea
        label="Observação (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações adicionais..."
        rows={2}
      />

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          Cancelar
        </Button>
        <Button fullWidth loading={loading} onClick={handleSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
