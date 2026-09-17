import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import type { Route, RouteFormData } from '../../types/route'

interface RouteFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: RouteFormData) => Promise<void>
  editRoute?: Route | null
}

export function RouteFormModal({ isOpen, onClose, onSave, editRoute }: RouteFormModalProps) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [errors, setErrors] = useState<{ origin?: string; destination?: string; monthlyAmount?: string }>({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (editRoute) {
        setOrigin(editRoute.origin)
        setDestination(editRoute.destination)
        setMonthlyAmount(String(editRoute.monthlyAmount))
      } else {
        setOrigin('')
        setDestination('')
        setMonthlyAmount('')
      }
      setErrors({})
      setApiError(null)
    }
  }, [isOpen, editRoute])

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!origin.trim()) e.origin = 'Informe o ponto de saída'
    if (!destination.trim()) e.destination = 'Informe o destino'
    const amount = parseFloat(monthlyAmount.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) e.monthlyAmount = 'Informe um valor válido maior que zero'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setApiError(null)
    try {
      await onSave({
        origin: origin.trim(),
        destination: destination.trim(),
        monthlyAmount: parseFloat(monthlyAmount.replace(',', '.')),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar rota'
      if (message.includes('origem e destino')) {
        setErrors({ origin: 'Já existe uma rota com esta origem e destino' })
      } else {
        setApiError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const isEditing = !!editRoute

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar rota' : 'Nova rota'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3">
            <p className="text-sm text-error">{apiError}</p>
          </div>
        )}
        <Input
          label="Ponto de saída"
          placeholder="Ex.: Ipiranga do Piauí"
          value={origin}
          onChange={(e) => { setOrigin(e.target.value); if (errors.origin) setErrors((p) => ({ ...p, origin: undefined })) }}
          error={errors.origin}
        />
        <Input
          label="Destino"
          placeholder="Ex.: Universidade Federal"
          value={destination}
          onChange={(e) => { setDestination(e.target.value); if (errors.destination) setErrors((p) => ({ ...p, destination: undefined })) }}
          error={errors.destination}
        />
        <Input
          label="Mensalidade"
          placeholder="0,00"
          value={monthlyAmount}
          onChange={(e) => { setMonthlyAmount(e.target.value); if (errors.monthlyAmount) setErrors((p) => ({ ...p, monthlyAmount: undefined })) }}
          error={errors.monthlyAmount}
          icon={<span className="text-sm text-gray-400">R$</span>}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" fullWidth loading={saving}>
            {isEditing ? 'Salvar' : 'Criar rota'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
