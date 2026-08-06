import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { realPayments } from '../../services/realApi'
import type { MonthlyFee } from '../../types/monthlyFee'

interface CardCheckoutProps {
  fee: MonthlyFee
  paymentUrl: string
  onPaid: () => void
  onBack: () => void
  onError: (message: string) => void
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 15 * 60 * 1000

export function CardCheckout({ fee, paymentUrl, onPaid, onBack, onError }: CardCheckoutProps) {
  const [waitingConfirmation, setWaitingConfirmation] = useState(false)
  const [expired, setExpired] = useState(false)
  const pollTimer = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const startPolling = () => {
      const startedAt = Date.now()
      pollTimer.current = window.setTimeout(async function tick() {
        if (!mountedRef.current) return
        try {
          const status = await realPayments.status(fee.id)
          if (status.status === 'paid') {
            onPaid()
            return
          }
          const elapsed = Date.now() - startedAt
          if (elapsed >= POLL_TIMEOUT_MS) {
            setExpired(true)
            return
          }
          pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS)
        } catch {
          pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS)
        }
      }, POLL_INTERVAL_MS)
    }

    const handleOpen = () => {
      setWaitingConfirmation(true)
      window.open(paymentUrl, '_blank', 'noopener,noreferrer')
      startPolling()
    }

    if (!paymentUrl) {
      onError('Não foi possível gerar o link de pagamento')
      return
    }
    handleOpen()

    return () => {
      mountedRef.current = false
      if (pollTimer.current) window.clearTimeout(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentUrl, fee.id])

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500">Pague a mensalidade de</p>
        <p className="text-lg font-bold text-text">R$ {fee.amount.toFixed(2).replace('.', ',')}</p>
        <p className="text-xs text-gray-400 mt-1">
          {fee.passengerName} | {String(fee.month).padStart(2, '0')}/{fee.year}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        Abrimos o pagamento do cartão em uma nova aba. Se ela não abriu, use o botão abaixo.
      </div>

      {waitingConfirmation && !expired && (
        <p className="text-sm text-center text-gray-500">
          Aguardando confirmação do pagamento do cartão...
        </p>
      )}
      {expired && (
        <p className="text-sm text-center text-amber-600">
          O tempo para confirmação expirou. Gere uma nova cobrança.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          fullWidth
          onClick={() => window.open(paymentUrl, '_blank', 'noopener,noreferrer')}
        >
          Abrir página de pagamento
        </Button>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  )
}
