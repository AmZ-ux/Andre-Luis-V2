import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '../ui/Button'
import { config } from '../../config'
import { realPayments } from '../../services/realApi'
import type { MonthlyFee } from '../../types/monthlyFee'

interface CardCheckoutProps {
  fee: MonthlyFee
  clientSecret: string
  onPaid: () => void
  onBack: () => void
  onError: (message: string) => void
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

export function CardCheckout({ fee, clientSecret, onPaid, onBack, onError }: CardCheckoutProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [processing, setProcessing] = useState(false)
  const [waitingConfirmation, setWaitingConfirmation] = useState(false)
  const [expired, setExpired] = useState(false)
  const elementsRef = useRef<any>(null)
  const pollTimer = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let unmounted = false

    const init = async () => {
      try {
        const stripe: any = await loadStripe(config.stripePublishableKey)
        if (!stripe) throw new Error('Não foi possível carregar o Stripe. Verifique a chave pública (VITE_STRIPE_PUBLISHABLE_KEY).')

        const elements = stripe.elements({ clientSecret })
        elementsRef.current = elements
        const paymentElement = elements.create('payment', { layout: 'tabs' })
        if (elementRef.current) paymentElement.mount(elementRef.current)
        elementsRef.current._paymentElement = paymentElement
      } catch (err: any) {
        if (mountedRef.current) onError(err?.message || 'Falha ao carregar o formulário de cartão')
      }
    }

    init()

    return () => {
      mountedRef.current = false
      unmounted = true
      if (pollTimer.current) window.clearTimeout(pollTimer.current)
      try { elementsRef.current?._paymentElement?.unmount() } catch {}
      try { elementsRef.current?.unmount() } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret])

  const startPolling = () => {
    pollTimer.current = window.setTimeout(async function tick() {
      if (!mountedRef.current) return
      const startedAt = Date.now()
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

  const handlePay = async () => {
    setProcessing(true)
    try {
      const stripe: any = await loadStripe(config.stripePublishableKey)
      if (!stripe) throw new Error('Não foi possível carregar o Stripe.')

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/minhas-mensalidades`,
          payment_method_data: { billing_details: { name: fee.passengerName } },
        },
        redirect: 'if_required',
      })

      if (error) {
        if (mountedRef.current) onError(error.message)
        return
      }
      if (paymentIntent?.status === 'succeeded') {
        onPaid()
        return
      }
      if (paymentIntent?.status === 'requires_action' || paymentIntent?.status === 'processing') {
        setWaitingConfirmation(true)
        startPolling()
        return
      }
      if (mountedRef.current) onError('Não foi possível concluir o pagamento')
    } catch (err: any) {
      if (mountedRef.current) onError(err?.message || 'Falha ao processar o pagamento')
    } finally {
      if (mountedRef.current) setProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500">Pague a mensalidade de</p>
        <p className="text-lg font-bold text-text">R$ {fee.amount.toFixed(2).replace('.', ',')}</p>
        <p className="text-xs text-gray-400 mt-1">
          {fee.passengerName} | {String(fee.month).padStart(2, '0')}/{fee.year}
        </p>
      </div>

      <div
        ref={elementRef}
        className="bg-white rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-h-[140px]"
      />

      {waitingConfirmation && !expired && (
        <p className="text-sm text-center text-gray-500">
          Aguardando confirmação do banco emissor do cartão...
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
          loading={processing}
          disabled={waitingConfirmation}
          onClick={handlePay}
        >
          Pagar com cartão
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
