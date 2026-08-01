import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { passengerService } from '../services/passengerService'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { receiptService } from '../services/receiptService'
import { availabilityService } from '../services/availabilityService'
import { calculateStatus } from '../services/statusCalculator'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PageSpinner } from '../components/ui/Spinner'
import {
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
  FileText,
  Receipt as ReceiptIcon,
  Wallet,
} from 'lucide-react'
import type { Passenger } from '../types/passenger'
import type { MonthlyFee, MonthlyFeeStatus } from '../types/monthlyFee'
import type { Receipt, ReceiptStatus } from '../types/receipt'
import type { Availability } from '../types/availability'

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

const receiptStatusLabel: Record<ReceiptStatus, string> = {
  awaiting: 'Em análise',
  approved: 'Aprovado',
  rejected: 'Reprovado',
  cancelled: 'Cancelado',
}

const receiptStatusVariant: Record<ReceiptStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  awaiting: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
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
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [passengerData, feeData, receiptData, availabilityData] = await Promise.all([
        passengerService.getById(user.id),
        monthlyFeeService.getByPassengerId(user.id),
        receiptService.getByPassengerId(user.id),
        availabilityService.getByPassengerId(user.id),
      ])
      setPassenger(passengerData)
      setFees(feeData)
      setReceipts(receiptData)
      setAvailabilities(availabilityData)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (loading || !user) return <PageSpinner />

  const now = new Date()
  const todayLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const firstName = user.name.split(' ')[0]

  const sortedFees = [...fees].sort((a, b) => b.year - a.year || b.month - a.month)
  const currentFee = sortedFees[0] || null
  const feeStatus = currentFee ? calculateStatus(currentFee, currentFee.payment) : null

  const upcoming = availabilities
    .filter((a) => a.status !== 'cancelled' && a.status !== 'finished')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3)

  const recentReceipts = [...receipts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Olá, {firstName}</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<ReceiptIcon className="h-4 w-4" />}
            onClick={() => navigate('/meus-comprovantes')}
          >
            Enviar comprovante
          </Button>
          <Button
            variant="secondary"
            icon={<CalendarOff className="h-4 w-4" />}
            onClick={() => navigate('/minha-disponibilidade')}
          >
            Ausência
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-text">Fatura atual</h2>
              </div>
              {currentFee && feeStatus && (
                <Badge variant={feeStatusVariant[feeStatus]}>{feeStatusLabel[feeStatus]}</Badge>
              )}
            </div>

            {currentFee ? (
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-text">{formatBR(currentFee.amount)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {MONTH_NAMES[currentFee.month - 1]} de {currentFee.year}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 text-text">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    Vencimento: {currentFee.dueDate}
                  </span>
                  {feeStatus === 'paid' ? (
                    <span className="flex items-center gap-1.5 text-success font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Paga em {currentFee.payment?.paymentDate || '-'}
                    </span>
                  ) : feeStatus === 'overdue' ? (
                    <span className="flex items-center gap-1.5 text-error font-medium">
                      <Clock className="h-4 w-4" />
                      Vencida há {Math.abs(daysUntil(currentFee.dueDate))} {Math.abs(daysUntil(currentFee.dueDate)) === 1 ? 'dia' : 'dias'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-warning font-medium">
                      <Clock className="h-4 w-4" />
                      Vence em {daysUntil(currentFee.dueDate)} {daysUntil(currentFee.dueDate) === 1 ? 'dia' : 'dias'}
                    </span>
                  )}
                </div>

                {(feeStatus === 'pending' || feeStatus === 'overdue') && (
                  <div className="pt-2">
                    <Button onClick={() => navigate('/meus-comprovantes')}>
                      Enviar comprovante de pagamento
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma mensalidade lançada ainda</p>
                {expectedFee !== null && passenger?.dueDay && (
                  <p className="text-xs text-gray-400 mt-1">
                    Mensalidade prevista: {formatBR(expectedFee)} · vence no dia {passenger.dueDay}
                  </p>
                )}
                <Button variant="secondary" className="mt-4" onClick={() => navigate('/meus-comprovantes')}>
                  Ver meus comprovantes
                </Button>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold text-text">Meu contrato</h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-text">Minhas mensalidades</h2>
              </div>
              <button
                onClick={() => navigate('/meus-comprovantes')}
                className="text-xs font-medium text-primary hover:underline"
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
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-text">Ausências</h2>
              </div>
              <button
                onClick={() => navigate('/minha-disponibilidade')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver tudo
              </button>
            </div>

            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma ausência programada</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((av) => (
                  <li key={av.id} className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-text">
                        {av.startDate} — {av.endDate}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{av.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-bold text-text">Comprovantes</h2>
              </div>
              <button
                onClick={() => navigate('/meus-comprovantes')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver tudo
              </button>
            </div>

            {recentReceipts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum comprovante enviado</p>
            ) : (
              <ul className="space-y-3">
                {recentReceipts.map((receipt) => (
                  <li key={receipt.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{receipt.fileName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {String(receipt.month).padStart(2, '0')}/{receipt.year} · {formatBR(receipt.amount)}
                      </p>
                    </div>
                    <Badge variant={receiptStatusVariant[receipt.status]}>
                      {receiptStatusLabel[receipt.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
