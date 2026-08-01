import { useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Button } from '../ui/Button'
import { config } from '../../config'
import { realPix } from '../../services/realApi'
import type { MonthlyFee } from '../../types/monthlyFee'

interface PixCheckoutProps {
  fee: MonthlyFee
  onPaid: () => void
  onBack: () => void
  onError: (message: string) => void
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

export function PixCheckout({ fee, onPaid, onBack, onError }: PixCheckoutProps) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [pixCode, setPixCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [waitingPayment, setWaitingPayment] = useState(false)
  const [expired, setExpired] = useState(false)
  const pollTimer = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let pixClient: any = null

    const init = async () => {
      try {
        const res = await realPix.create(fee.id)
        if (!res.clientSecret) throw new Error('Sem clientSecret na resposta do servidor')

        const stripe: any = await loadStripe(config.stripePublishableKey)
        if (!stripe) throw new Error('Não foi possível carregar o Stripe. Verifique a chave pública (VITE_STRIPE_PUBLISHABLE_KEY).')

        pixClient = stripe.initPixClient()
        const { paymentIntent } = await stripe.confirmPixPayment(pixClient, {
          clientSecret: res.clientSecret,
        })
        if (paymentIntent?.status === 'processing' || paymentIntent?.status === 'requires_action') {
          setWaitingPayment(true)
          if (qrRef.current) pixClient.mountQrCode(qrRef.current)
          const code = pixClient.getPixCode()
          setPixCode(typeof code === 'string' ? code : '')
          startPolling()
        } else if (paymentIntent?.status === 'succeeded') {
          onPaid()
        } else {
          throw new Error('Não foi possível iniciar o pagamento PIX')
        }
      } catch (err: any) {
        if (mountedRef.current) onError(err?.message || 'Falha ao gerar o PIX')
      }
    }

    const startPolling = () => {
      pollTimer.current = window.setTimeout(async function tick() {
        if (!mountedRef.current) return
        try {
          const status = await realPix.status(fee.id)
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
    const startedAt = Date.now()

    init()

    return () => {
      mountedRef.current = false
      if (pollTimer.current) window.clearTimeout(pollTimer.current)
      try { pixClient?.unmount() } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fee.id])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(pixCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {}
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

      <div className="flex justify-center">
        <div
          ref={qrRef}
          className="w-56 h-56 bg-white rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center"
        >
          {!waitingPayment && <span className="text-sm text-gray-400">Gerando QR Code...</span>}
        </div>
      </div>

      {pixCode && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Ou copie o código PIX:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={pixCode}
              className="w-full text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-500"
            />
            <Button variant="secondary" size="sm" onClick={copyCode}>
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}

      {waitingPayment && !expired && (
        <p className="text-sm text-center text-gray-500">
          Aguardando confirmação do pagamento no seu banco...
        </p>
      )}
      {expired && (
        <p className="text-sm text-center text-amber-600">
          O tempo para pagamento expirou. Gere uma nova cobrança.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" fullWidth onClick={onBack}>
          Voltar
        </Button>
      </div>
    </div>
  )
}
