import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { MonthlyFeeStatus } from '../components/monthlyFees/MonthlyFeeStatus'
import { FeeCheckoutModal } from '../components/monthlyFees/FeeCheckoutModal'
import { PageTabs } from '../components/ui/PageTabs'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useToast } from '../contexts/ToastContext'
import { MinhaDisponibilidade } from './MinhaDisponibilidade'
import { Wallet, RefreshCw, CreditCard, CalendarOff } from 'lucide-react'
import type { MonthlyFee } from '../types/monthlyFee'

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const tabs = [
  { key: 'faturas', label: 'Mensalidades', icon: Wallet },
  { key: 'ausencias', label: 'Ausências', icon: CalendarOff },
]

export function MinhasMensalidades() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkoutFee, setCheckoutFee] = useState<MonthlyFee | null>(null)

  const tab = searchParams.get('tab') === 'ausencias' ? 'ausencias' : 'faturas'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'faturas' ? {} : { tab: key }, { replace: true })
  }

  const load = useCallback(async (ensure = true) => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      if (ensure) {
        try { await monthlyFeeService.ensureCurrent() } catch {}
      }
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
      load(false)
    } else if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      addToast('error', 'O pagamento não foi concluído')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, addToast, load])

  const handleEnsureCurrent = async () => {
    try {
      await monthlyFeeService.ensureCurrent()
      await load(false)
      addToast('success', 'Mensalidades atualizadas!')
    } catch (err: any) {
      addToast('error', err?.message || 'Não foi possível atualizar as mensalidades')
    }
  }

  const handlePaid = () => {
    addToast('success', 'Pagamento confirmado!')
    setCheckoutFee(null)
    load(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            {tab === 'ausencias' ? (
              <>
                <CalendarOff className="h-5 w-5 text-primary" />
                Disponibilidade
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5 text-primary" />
                Minhas Mensalidades
              </>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tab === 'ausencias'
              ? 'Gerencie seus períodos de ausência e férias'
              : 'Pague suas mensalidades com PIX ou cartão'}
          </p>
        </div>
        {tab === 'faturas' && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={handleEnsureCurrent}
          >
            Atualizar
          </Button>
        )}
      </div>

      <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />

      {tab === 'ausencias' ? (
        <MinhaDisponibilidade embedded />
      ) : (
        <>
          {loading ? (
        <PageSpinner />
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-sm text-error">{loadError}</p>
          <Button variant="secondary" className="mt-4" onClick={() => load()}>Tentar novamente</Button>
        </div>
      ) : fees.length === 0 ? (
        <div className="text-center py-16">
          <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhuma mensalidade encontrada</p>
          <Button className="mt-4" onClick={handleEnsureCurrent}>Gerar mensalidades</Button>
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
                    <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => setCheckoutFee(fee)}>
                      Efetuar pagamento
                    </Button>
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

      <FeeCheckoutModal fee={checkoutFee} onClose={() => setCheckoutFee(null)} onPaid={handlePaid} />
        </>
      )}
    </div>
  )
}
