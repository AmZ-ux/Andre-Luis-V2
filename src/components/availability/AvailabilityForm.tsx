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
  existing?: { startDate: string; endDate: string; id: string }[]
}

export function AvailabilityForm({ onSubmit, onCancel, loading = false, submitLabel = 'Confirmar', existing = [] }: AvailabilityFormProps) {
  const [type, setType] = useState<string>('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!startDate) errs.startDate = 'Data inicial é obrigatória'
    if (!endDate) errs.endDate = 'Data final é obrigatória'
    const dateResult = availabilityValidation.validateDates(startDate, endDate)
    if (!dateResult.valid) {
      errs.startDate = errs.startDate || dateResult.error || ''
      errs.endDate = errs.endDate || dateResult.error || ''
    }
    const overlapResult = availabilityValidation.validateNoOverlap(startDate, endDate, existing)
    if (!overlapResult.valid) {
      errs.startDate = overlapResult.error || ''
      errs.endDate = overlapResult.error || ''
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
          onChange={(e) => { setStartDate(e.target.value); clearError('startDate') }}
          error={errors.startDate}
        />
        <Input
          label="Data final"
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); clearError('endDate') }}
          error={errors.endDate}
        />
      </div>

      <Textarea
        label="Motivo"
        value={reason}
        onChange={(e) => { setReason(e.target.value); clearError('reason') }}
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