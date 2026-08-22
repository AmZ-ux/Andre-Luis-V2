import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { MonthlyFeeStatus } from '../components/monthlyFees/MonthlyFeeStatus'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { ArrowLeft, DollarSign, Calendar, User, Building2, FileText, CreditCard, Clock } from 'lucide-react'
import type { MonthlyFee } from '../types/monthlyFee'

const monthNames = [
  'Janeiro', 'Fevereiro', 'MarÃ§o', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const paymentLabels: Record<string, string> = {
  pix: 'PIX', cash: 'Dinheiro', transfer: 'TransferÃªncia', card: 'CartÃ£o',
}

export function MensalidadeProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [fee, setFee] = useState<MonthlyFee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    monthlyFeeService
      .getById(id)
      .then((data) => {
        if (!data) setError(true)
        else setFee(data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageSpinner />
  if (error || !fee) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-text">Mensalidade nÃ£o encontrada</h2>
        <Button onClick={() => navigate('/mensalidades')} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    )
  }

  const infoItems = [
    { icon: User, label: 'Passageiro', value: fee.passengerName },
    { icon: Building2, label: 'CPF', value: fee.cpf },
    { icon: Building2, label: 'Tipo', value: fee.transportType === 'university' ? 'UniversitÃ¡rio' : fee.transportType === 'school' ? 'Escolar' : 'Contrato' },
    ...(fee.institution ? [{ icon: Building2, label: 'InstituiÃ§Ã£o/Empresa', value: fee.institution }] : []),
    ...(fee.company ? [{ icon: Building2, label: 'Empresa', value: fee.company }] : []),
  ]

  const feeInfo = [
    { icon: DollarSign, label: 'Valor', value: `R$ ${fee.amount.toFixed(2).replace('.', ',')}` },
    { icon: Calendar, label: 'CompetÃªncia', value: `${monthNames[fee.month - 1]} ${fee.year}` },
    { icon: Calendar, label: 'Vencimento', value: fee.dueDate },
    { icon: Clock, label: 'Status', value: '' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <button
        onClick={() => navigate('/mensalidades')}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para lista
      </button>

      <Card>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-1.5">Financeiro</p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Detalhes da Mensalidade</h1>
            <p className="text-sm text-gray-500 mt-1">
              {monthNames[fee.month - 1]} {fee.year}
            </p>
          </div>
          <MonthlyFeeStatus status={fee.status} />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Dados do Passageiro
          </h2>
          <div className="space-y-3">
            {infoItems.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="text-sm text-text">{item.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> InformaÃ§Ãµes Financeiras
          </h2>
          <div className="space-y-3">
            {feeInfo.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    {item.label === 'Status' ? (
                      <MonthlyFeeStatus status={fee.status} />
                    ) : (
                      <p className="text-sm text-text">{item.value}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {fee.payment && (
        <Card>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-success" /> Pagamento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Valor pago</p>
                <p className="text-sm text-text">R$ {fee.payment.amount.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Data do pagamento</p>
                <p className="text-sm text-text">{fee.payment.paymentDate}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Forma de pagamento</p>
                <p className="text-sm text-text">{paymentLabels[fee.payment.paymentMethod] || fee.payment.paymentMethod}</p>
              </div>
            </div>
            {fee.payment.notes && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">ObservaÃ§Ã£o</p>
                  <p className="text-sm text-text">{fee.payment.notes}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {fee.cancellationReason && (
        <Card>
          <h2 className="text-sm font-bold text-text mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-error" /> Motivo do Cancelamento
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{fee.cancellationReason}</p>
        </Card>
      )}

      {fee.exemptionReason && (
        <Card>
          <h2 className="text-sm font-bold text-text mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" /> Motivo da IsenÃ§Ã£o
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{fee.exemptionReason}</p>
        </Card>
      )}

      {fee.notes && !fee.cancellationReason && !fee.exemptionReason && (
        <Card>
          <h2 className="text-sm font-bold text-text mb-2">ObservaÃ§Ãµes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{fee.notes}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> HistÃ³rico
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <p className="text-sm text-text">Mensalidade criada</p>
              <p className="text-xs text-gray-400">{fee.createdAt}</p>
            </div>
          </div>
          {fee.payment && (
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-success mt-1.5 shrink-0" />
              <div>
                <p className="text-sm text-text">Pagamento registrado</p>
                <p className="text-xs text-gray-400">{fee.payment.createdAt}</p>
              </div>
            </div>
          )}
          {fee.status === 'cancelled' && (
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-error mt-1.5 shrink-0" />
              <div>
                <p className="text-sm text-text">Mensalidade cancelada</p>
                <p className="text-xs text-gray-400">{fee.updatedAt}</p>
              </div>
            </div>
          )}
          {fee.status === 'exempt' && (
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-sm text-text">IsenÃ§Ã£o concedida</p>
                <p className="text-xs text-gray-400">{fee.updatedAt}</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
