import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { PixCheckout } from './PixCheckout'
import { CardCheckout } from './CardCheckout'
import { realPayments } from '../../services/realApi'
import { QrCode, CreditCard } from 'lucide-react'
import type { MonthlyFee } from '../../types/monthlyFee'

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface FeeCheckoutModalProps {
  fee: MonthlyFee | null
  onClose: () => void
  onPaid: () => void
}

type CheckoutMethod = 'pix' | 'card' | null

export function FeeCheckoutModal({ fee, onClose, onPaid }: FeeCheckoutModalProps) {
  const [method, setMethod] = useState<CheckoutMethod>(null)
  const [cardClientSecret, setCardClientSecret] = useState('')
  const [preparingCard, setPreparingCard] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const close = () => {
    setMethod(null)
    setCardClientSecret('')
    setPaymentError(null)
    onClose()
  }

  const openMethod = (nextMethod: 'pix' | 'card') => {
    if (!fee) return
    setPaymentError(null)
    setMethod(nextMethod)
    setCardClientSecret('')
    if (nextMethod === 'card') {
      setPreparingCard(true)
      realPayments.create(fee.id, 'card')
        .then((res) => setCardClientSecret(res.clientSecret))
        .catch((err: any) => setPaymentError(err?.message || 'Falha ao preparar o pagamento'))
        .finally(() => setPreparingCard(false))
    }
  }

  return (
    <Modal
      isOpen={!!fee}
      onClose={close}
      title={fee ? `Pagamento - ${monthNames[(fee.month - 1) % 12]} ${fee.year}` : 'Pagamento'}
    >
      {fee && (
        <div className="space-y-4">
          {paymentError && (
            <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
              {paymentError}
            </div>
          )}

          {method === null && (
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="secondary"
                fullWidth
                className="justify-start"
                icon={<QrCode className="h-5 w-5" />}
                onClick={() => openMethod('pix')}
              >
                Pagar com PIX
              </Button>
              <Button
                fullWidth
                className="justify-start"
                icon={<CreditCard className="h-5 w-5" />}
                loading={preparingCard}
                onClick={() => openMethod('card')}
              >
                Pagar com cartão
              </Button>
            </div>
          )}

          {method === 'pix' && (
            <PixCheckout
              fee={fee}
              onPaid={onPaid}
              onBack={() => { setMethod(null); setPaymentError(null) }}
              onError={(message) => setPaymentError(message)}
            />
          )}

          {method === 'card' && (preparingCard ? (
            <p className="text-sm text-center text-gray-500 py-8">Preparando pagamento...</p>
          ) : cardClientSecret ? (
            <CardCheckout
              fee={fee}
              clientSecret={cardClientSecret}
              onPaid={onPaid}
              onBack={() => { setMethod(null); setPaymentError(null) }}
              onError={(message) => setPaymentError(message)}
            />
          ) : (
            <p className="text-sm text-center text-gray-500 py-8">Não foi possível iniciar o pagamento</p>
          ))}
        </div>
      )}
    </Modal>
  )
}
