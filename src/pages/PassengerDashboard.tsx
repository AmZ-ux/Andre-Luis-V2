import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { passengerService } from '../services/passengerService'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { calculateStatus } from '../services/statusCalculator'
import { FeeCheckoutModal } from '../components/monthlyFees/FeeCheckoutModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PageSpinner } from '../components/ui/Spinner'
import {
  CheckCircle2,
  Clock,
  Wallet,
} from 'lucide-react'
import type { Passenger } from '../types/passenger'
import type { MonthlyFee, MonthlyFeeStatus } from '../types/monthlyFee'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const typeLabel: Record<string, string> = {
  university: 'Universitário',
  school: 'Escolar',
  contract: 'Contrato',
}

const paymentLabel: Record<string, string> = {
  pix: 'PIX', cash: 'Dinheiro', transfer: 'Transferência', card: 'Cartão',
}

const feeStatusLabel: Record<MonthlyFeeStatus, string> = {
  pending: 'Pendente',
  paid: 'Paga',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
  exempt: 'Isenta',
}

const feeStatusVariant: Record<MonthlyFeeStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'neutral',
  exempt: 'neutral',
}

function parseBRDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number)
  return new Date(year, month - 1, day)
}

function daysUntil(dateStr: string): number {
  const due = parseBRDate(dateStr)
  const today = new Date()
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((due.getTime() - midnight.getTime()) / 86400000)
}

function formatBR(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatISOToBR(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function PassengerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [passenger, setPassenger] = useState<Passenger | null>(null)
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [checkoutFee, setCheckoutFee] = useState<MonthlyFee | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(false)
    try {
      try { await monthlyFeeService.ensureCurrent() } catch {}
      const [passengerRes, feeRes] = await Promise.allSettled([
        passengerService.getMe(),
        monthlyFeeService.getByPassengerId(user.id),
      ])
      if (passengerRes.status === 'fulfilled') {
        setPassenger(passengerRes.value ?? null)
      } else {
        setPassenger(null)
      }
      if (feeRes.status === 'rejected') {
        throw new Error('fees')
      }
      setFees(feeRes.value)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !user) return <PageSpinner />

  if (loadError && fees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="h-16 w-16 rounded-lg bg-error-soft flex items-center justify-center mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Não foi possível carregar</h2>
        <p className="text-sm text-gray-500 mb-6">Ocorreu um erro ao buscar suas mensalidades.</p>
        <Button onClick={() => load()}>Tentar novamente</Button>
      </div>
    )
  }

  const sortedFees = [...fees].sort((a, b) => b.year - a.year || b.month - a.month)
  const nextUnpaid = [...fees]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .find((f) => f.status === 'pending' || f.status === 'overdue')
  const currentFee = nextUnpaid || sortedFees[0] || null
  const feeStatus = currentFee ? calculateStatus(currentFee, currentFee.payment) : null

  const contractDate = passenger?.contractStartDate
    ? formatISOToBR(passenger.contractStartDate)
    : passenger?.createdAt || user.createdAt
  const expectedFee = passenger?.monthlyFee ?? currentFee?.amount ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-primary-dark text-white p-6 sm:p-7 shadow-pop h-full flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                Fatura atual{currentFee ? ` · ${MONTH_NAMES[currentFee.month - 1]} ${currentFee.year}` : ''}
              </p>
              {currentFee && feeStatus && (
                <Badge variant={feeStatusVariant[feeStatus]} dot>{feeStatusLabel[feeStatus]}</Badge>
              )}
            </div>

            {currentFee ? (
              <div className="space-y-5 flex-1">
                <div>
                  <p className="text-[42px] leading-none font-bold tracking-tight">{formatBR(currentFee.amount)}</p>
                  <p className="text-sm text-white/70 mt-3">
                    Vencimento: {currentFee.dueDate}
                  </p>
                </div>

                {feeStatus === 'paid' ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-200 text-sm font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Paga em {currentFee.payment?.paymentDate || '-'}
                  </span>
                ) : feeStatus === 'overdue' ? (
                  <span className="inline-flex items-center gap-1.5 text-red-200 text-sm font-semibold">
                    <Clock className="h-4 w-4" />
                    Vencida há {Math.abs(daysUntil(currentFee.dueDate))} {Math.abs(daysUntil(currentFee.dueDate)) === 1 ? 'dia' : 'dias'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-200 text-sm font-semibold">
                    <Clock className="h-4 w-4" />
                    Vence em {daysUntil(currentFee.dueDate)} {daysUntil(currentFee.dueDate) === 1 ? 'dia' : 'dias'}
                  </span>
                )}

                {(feeStatus === 'pending' || feeStatus === 'overdue') && (
                  <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      onClick={() => setCheckoutFee(currentFee)}
                      className="bg-white text-primary-dark hover:bg-blue-50 active:bg-blue-100 w-full sm:w-auto"
                    >
                      Efetuar pagamento
                    </Button>
                    <button
                      onClick={() => navigate('/minhas-mensalidades')}
                      className="text-sm font-semibold text-white/80 hover:text-white transition-colors"
                    >
                      Ver tudo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 flex-1 flex flex-col items-center justify-center">
                <Wallet className="h-10 w-10 text-white/40 mx-auto mb-3" />
                <p className="text-sm text-white/80">Nenhuma mensalidade lançada ainda</p>
                {expectedFee !== null && passenger?.dueDay && (
                  <p className="text-xs text-white/60 mt-1">
                    Mensalidade prevista: {formatBR(expectedFee)} · vence no dia {passenger.dueDay}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <Card className="lg:order-3 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text">Minhas mensalidades</h2>
            <button
              onClick={() => navigate('/minhas-mensalidades')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver tudo
            </button>
          </div>

          {sortedFees.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma mensalidade lançada</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedFees.slice(0, 5).map((fee) => {
                const status = calculateStatus(fee, fee.payment)
                return (
                  <li key={fee.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-text">
                        {MONTH_NAMES[fee.month - 1]} de {fee.year}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Venceu em {fee.dueDate}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-text">{formatBR(fee.amount)}</span>
                      <Badge variant={feeStatusVariant[status]}>{feeStatusLabel[status]}</Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text">Meu contrato</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Início do contrato</dt>
              <dd className="font-semibold text-text mt-0.5">{contractDate}</dd>
            </div>
            {passenger?.pickupPoint && (
              <div>
                <dt className="text-xs text-gray-400">Ponto de saída</dt>
                <dd className="font-semibold text-text mt-0.5">{passenger.pickupPoint}</dd>
              </div>
            )}
            {passenger?.destination && (
              <div>
                <dt className="text-xs text-gray-400">Destino</dt>
                <dd className="font-semibold text-text mt-0.5">{passenger.destination}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-400">Tipo de transporte</dt>
              <dd className="font-semibold text-text mt-0.5">
                {passenger ? typeLabel[passenger.transportType] || '-' : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Mensalidade</dt>
              <dd className="font-semibold text-text mt-0.5">
                {expectedFee !== null ? formatBR(expectedFee) : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Vencimento</dt>
              <dd className="font-semibold text-text mt-0.5">
                {passenger?.dueDay ? `Dia ${passenger.dueDay}` : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Forma de pagamento</dt>
              <dd className="font-semibold text-text mt-0.5">
                {passenger ? paymentLabel[passenger.paymentMethod] || '-' : '-'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <FeeCheckoutModal
        fee={checkoutFee}
        onClose={() => setCheckoutFee(null)}
        onPaid={() => { setCheckoutFee(null); load() }}
      />
    </motion.div>
  )
}