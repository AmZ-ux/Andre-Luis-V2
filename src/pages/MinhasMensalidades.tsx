import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { realPayments } from '../services/realApi'
import { MonthlyFeeStatus } from '../components/monthlyFees/MonthlyFeeStatus'
import { PixCheckout } from '../components/monthlyFees/PixCheckout'
import { CardCheckout } from '../components/monthlyFees/CardCheckout'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useToast } from '../contexts/ToastContext'
import { Wallet, QrCode, CreditCard, RefreshCw } from 'lucide-react'
import type { MonthlyFee } from '../types/monthlyFee'

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type CheckoutMethod = 'pix' | 'card' | null

export function MinhasMensalidades() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedFee, setSelectedFee] = useState<MonthlyFee | null>(null)
  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod>(null)
  const [cardClientSecret, setCardClientSecret] = useState('')
  const [preparingCard, setPreparingCard] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      let fees = await monthlyFeeService.getByPassengerId(user.id)
      fees = fees.sort((a, b) => (b.year - a.year) || (b.month - a.month))
      setFees(fees)
    } catch {
      setLoadError('Erro ao carregar suas mensalidades')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const redirectStatus = searchParams.get('redirect_status')
    if (redirectStatus === 'succeeded') {
      addToast('success', 'Pagamento confirmado!')
      setSearchParams({}, { replace: true })
      load()
    } else if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      addToast('error', 'O pagamento não foi concluído')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, addToast, load])

  const handleEnsureCurrent = async () => {
    try {
      await monthlyFeeService.ensureCurrent()
      await load()
      addToast('success', 'Mensalidade deste mês gerada!')
    } catch (err: any) {
      addToast('error', err?.message || 'Não foi possível gerar a mensalidade deste mês')
    }
  }

  const openCheckout = (fee: MonthlyFee, method: 'pix' | 'card') => {
    setPaymentError(null)
    setSelectedFee(fee)
    setCheckoutMethod(method)
    setCardClientSecret('')
    if (method === 'card') {
      setPreparingCard(true)
      realPayments.create(fee.id, 'card')
        .then((res) => setCardClientSecret(res.clientSecret))
        .catch((err: any) => setPaymentError(err?.message || 'Falha ao preparar o pagamento'))
        .finally(() => setPreparingCard(false))
    }
  }

  const closeCheckout = () => {
    setSelectedFee(null)
    setCheckoutMethod(null)
    setCardClientSecret('')
    setPaymentError(null)
  }

  const handlePaid = () => {
    addToast('success', 'Pagamento confirmado!')
    closeCheckout()
    load()
  }

  const payable = fees.filter((f) => f.status === 'pending' || f.status === 'overdue')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Minhas Mensalidades
          </h1>
          <p className="text-sm text-gray-500 mt-1">Pague suas mensalidades com PIX ou cartão</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={handleEnsureCurrent}
        >
          Gerar mês atual
        </Button>
      </div>

      {loading ? (
        <PageSpinner />
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-sm text-error">{loadError}</p>
          <Button variant="secondary" className="mt-4" onClick={load}>Tentar novamente</Button>
        </div>
      ) : fees.length === 0 ? (
        <div className="text-center py-16">
          <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma mensalidade encontrada</p>
          <Button className="mt-4" onClick={handleEnsureCurrent}>Gerar mensalidade deste mês</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fees.map((fee, i) => {
            const canPay = fee.status === 'pending' || fee.status === 'overdue'
            return (
              <motion.div
                key={fee.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">
                      {monthNames[fee.month - 1]} {fee.year}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Vence {fee.dueDate}</p>
                  </div>
                  <MonthlyFeeStatus status={fee.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-lg font-bold text-text">
                    R$ {fee.amount.toFixed(2).replace('.', ',')}
                  </p>
                  {canPay && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<QrCode className="h-4 w-4" />}
                        onClick={() => openCheckout(fee, 'pix')}
                      >
                        PIX
                      </Button>
                      <Button
                        size="sm"
                        icon={<CreditCard className="h-4 w-4" />}
                        onClick={() => openCheckout(fee, 'card')}
                      >
                        Cartão
                      </Button>
                    </div>
                  )}
                  {fee.status === 'paid' && fee.payment && (
                    <p className="text-sm text-success">Pago em {fee.payment.paymentDate}</p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={!!selectedFee}
        onClose={closeCheckout}
        title={selectedFee ? `Pagamento - ${monthNames[(selectedFee.month - 1) % 12]} ${selectedFee.year}` : 'Pagamento'}
      >
        {selectedFee && (
          <div className="space-y-4">
            {paymentError && (
              <div className="bg-error/5 border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
                {paymentError}
              </div>
            )}

            {checkoutMethod === null && (
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  className="justify-start"
                  icon={<QrCode className="h-5 w-5" />}
                  onClick={() => openCheckout(selectedFee, 'pix')}
                >
                  Pagar com PIX
                </Button>
                <Button
                  fullWidth
                  className="justify-start"
                  icon={<CreditCard className="h-5 w-5" />}
                  loading={preparingCard}
                  onClick={() => openCheckout(selectedFee, 'card')}
                >
                  Pagar com cartão
                </Button>
              </div>
            )}

            {checkoutMethod === 'pix' && (
              <PixCheckout
                fee={selectedFee}
                onPaid={handlePaid}
                onBack={() => { setCheckoutMethod(null); setPaymentError(null) }}
                onError={(message) => setPaymentError(message)}
              />
            )}

            {checkoutMethod === 'card' && (preparingCard ? (
              <p className="text-sm text-center text-gray-500 py-8">Preparando pagamento...</p>
            ) : cardClientSecret ? (
              <CardCheckout
                fee={selectedFee}
                clientSecret={cardClientSecret}
                onPaid={handlePaid}
                onBack={() => { setCheckoutMethod(null); setPaymentError(null) }}
                onError={(message) => setPaymentError(message)}
              />
            ) : (
              <p className="text-sm text-center text-gray-500 py-8">Não foi possível iniciar o pagamento</p>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
