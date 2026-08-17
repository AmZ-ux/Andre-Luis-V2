import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import type { MonthlyFee } from '../../types/monthlyFee'
import type { PaymentMethod } from '../../types/passenger'

interface ManualPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: {
    amount: number
    paymentDate: string
    paymentMethod: PaymentMethod
    notes?: string
  }) => Promise<void>
  fee: MonthlyFee | null
}

const paymentMethodOptions = [
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'card', label: 'Cartão' },
]

function todayBR(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function ManualPaymentModal({ isOpen, onClose, onConfirm, fee }: ManualPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayBR())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fee) {
      setAmount(fee.amount.toFixed(2).replace('.', ','))
      setPaymentDate(todayBR())
      setPaymentMethod('pix')
      setNotes('')
      setErrors({})
    }
  }, [fee, isOpen])

  const parseAmount = (value: string): number | null => {
    const normalized = value.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const parseDate = (value: string): string | null => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (!match) return null
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = new Date(iso)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
    return iso
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!parseAmount(amount)) errs.amount = 'Informe um valor válido (maior que zero)'
    if (!parseDate(paymentDate)) errs.paymentDate = 'Data inválida (use dd/mm/aaaa)'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const parsedAmount = parseAmount(amount)
      const isoDate = parseDate(paymentDate)
      if (!parsedAmount || !isoDate) return
      await onConfirm({
        amount: parsedAmount,
        paymentDate: isoDate,
        paymentMethod,
        notes: notes || undefined,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!fee) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Pagamento">
      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
          <p className="text-sm font-medium text-text">{fee.passengerName}</p>
          <p className="text-xs text-gray-400 mt-1">
            Competência: {String(fee.month).padStart(2, '0')}/{fee.year}
          </p>
        </div>

        <Input
          label="Valor pago (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="0,00"
          inputMode="decimal"
        />
        <Input
          label="Data do pagamento"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          error={errors.paymentDate}
          placeholder="dd/mm/aaaa"
        />
        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          options={paymentMethodOptions}
        />
        <Textarea
          label="Observação"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancelar
          </Button>
          <Button fullWidth loading={loading} onClick={handleSubmit}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  )
}