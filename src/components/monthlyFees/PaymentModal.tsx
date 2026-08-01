import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { PixCheckout } from './PixCheckout'
import { monthlyRules } from '../../services/monthlyRules'
import { config } from '../../config'
import type { MonthlyFee, PaymentFormData } from '../../types/monthlyFee'
import type { PaymentMethod } from '../../types/passenger'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: PaymentFormData) => Promise<void>
  onPixPaid?: () => void
  fee: MonthlyFee | null
}

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'card', label: 'Cartão' },
]

export function PaymentModal({ isOpen, onClose, onConfirm, onPixPaid, fee }: PaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showPix, setShowPix] = useState(false)
  const [pixError, setPixError] = useState('')

  useEffect(() => {
    if (fee) {
      setAmount(fee.amount.toFixed(2).replace('.', ','))
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('pix')
      setNotes('')
      setErrors({})
      setShowPix(false)
      setPixError('')
    }
  }, [fee])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    const amountErr = monthlyRules.validateAmount(amount)
    if (amountErr) errs.amount = amountErr
    const dateErr = monthlyRules.validatePaymentDate(paymentDate)
    if (dateErr) errs.paymentDate = dateErr
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    if (config.realApi && paymentMethod === 'pix') {
      setShowPix(true)
      setPixError('')
      return
    }
    setLoading(true)
    try {
      await onConfirm({
        amount: parseFloat(amount.replace(',', '.')).toFixed(2),
        paymentDate,
        paymentMethod,
        notes,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handlePixError = (message: string) => {
    setPixError(message)
    setShowPix(false)
  }

  if (!fee) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={showPix ? 'Pagamento PIX' : 'Registrar Pagamento'}>
      <div className="space-y-4">
        {showPix ? (
          <>
            {pixError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg p-3">
                {pixError}
              </div>
            )}
            <PixCheckout
              fee={fee}
              onPaid={() => {
                onPixPaid?.()
                onClose()
              }}
              onBack={() => setShowPix(false)}
              onError={handlePixError}
            />
          </>
        ) : (
          <>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Passageiro</p>
              <p className="text-sm font-semibold text-text">{fee.passengerName}</p>
              <p className="text-xs text-gray-400 mt-1">
                Competência: {String(fee.month).padStart(2, '0')}/{fee.year} | Vencimento: {fee.dueDate}
              </p>
            </div>

            <Input
              label="Valor recebido (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={errors.amount}
              placeholder="0,00"
            />
            <Input
              label="Data do pagamento"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              error={errors.paymentDate}
            />
            <Select
              label="Forma de pagamento"
              options={methods}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            />
            <Textarea
              label="Observação"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              rows={3}
            />

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" fullWidth onClick={onClose}>
                Cancelar
              </Button>
              <Button fullWidth loading={loading} onClick={handleSubmit}>
                {config.realApi && paymentMethod === 'pix' ? 'Gerar PIX' : 'Confirmar Pagamento'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
