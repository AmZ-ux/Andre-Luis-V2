import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { passengerService } from '../services/passengerService'
import { PassengerAvatar } from '../components/passengers/PassengerAvatar'
import { PassengerStatusBadge } from '../components/passengers/PassengerStatusBadge'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, DollarSign, CreditCard, FileText, Building2, BookOpen, Briefcase } from 'lucide-react'
import type { Passenger } from '../types/passenger'

const typeLabel: Record<string, string> = {
  university: 'UniversitÃ¡rio',
  school: 'Escolar',
  contract: 'Contrato',
}

const paymentLabel: Record<string, string> = {
  pix: 'PIX', cash: 'Dinheiro', transfer: 'TransferÃªncia', card: 'CartÃ£o',
}

export function PassageiroProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [passenger, setPassenger] = useState<Passenger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    passengerService
      .getById(id)
      .then((data) => {
        if (!data) setError(true)
        else setPassenger(data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageSpinner />
  if (error || !passenger) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-text">Passageiro nÃ£o encontrado</h2>
        <Button onClick={() => navigate('/passageiros')} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    )
  }

  const infoItems = [
    { icon: Phone, label: 'Telefone', value: passenger.phone },
    { icon: Phone, label: 'WhatsApp', value: passenger.whatsapp || '-' },
    { icon: Mail, label: 'Email', value: passenger.email },
    { icon: MapPin, label: 'EndereÃ§o', value: `${passenger.address.street}, ${passenger.address.number}${passenger.address.complement ? ` - ${passenger.address.complement}` : ''} - ${passenger.address.neighborhood}, ${passenger.address.city}/${passenger.address.state} - CEP ${passenger.address.zipCode}` },
    { icon: Calendar, label: 'CPF', value: passenger.cpf },
    { icon: Calendar, label: 'RG', value: passenger.rg || '-' },
    { icon: Calendar, label: 'Nascimento', value: passenger.birthDate },
    { icon: Calendar, label: 'Cadastro', value: passenger.createdAt },
  ]

  const transportInfo = [
    { icon: Building2, label: 'Tipo', value: typeLabel[passenger.transportType] },
    ...(passenger.institution ? [{ icon: BookOpen, label: passenger.transportType === 'school' ? 'Escola' : 'InstituiÃ§Ã£o', value: passenger.institution }] : []),
    ...(passenger.course ? [{ icon: BookOpen, label: 'Curso', value: passenger.course }] : []),
    ...(passenger.class ? [{ icon: BookOpen, label: 'Turma', value: passenger.class }] : []),
    ...(passenger.company ? [{ icon: Briefcase, label: 'Empresa', value: passenger.company }] : []),
    ...(passenger.workplace ? [{ icon: Briefcase, label: 'Local de trabalho', value: passenger.workplace }] : []),
  ]

  const financeInfo = [
    { icon: DollarSign, label: 'Mensalidade', value: `R$ ${passenger.monthlyFee.toFixed(2).replace('.', ',')}` },
    { icon: CreditCard, label: 'Vencimento', value: `Dia ${passenger.dueDay}` },
    { icon: CreditCard, label: 'Pagamento', value: paymentLabel[passenger.paymentMethod] },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <button
        onClick={() => navigate('/passageiros')}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para lista
      </button>

      <Card>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <PassengerAvatar name={passenger.name} size="lg" />
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text truncate">{passenger.name}</h1>
              <PassengerStatusBadge status={passenger.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{typeLabel[passenger.transportType]}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => navigate('/passageiros')}
          >
            Editar
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Dados Pessoais
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

        <div className="space-y-6">
          <Card>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Transporte
            </h2>
            <div className="space-y-3">
              {transportInfo.map((item) => {
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
              <DollarSign className="h-4 w-4 text-primary" /> Financeiro
            </h2>
            <div className="space-y-3">
              {financeInfo.map((item) => {
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
        </div>
      </div>

      {passenger.notes && (
        <Card>
          <h2 className="text-sm font-bold text-text mb-2">ObservaÃ§Ãµes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{passenger.notes}</p>
        </Card>
      )}
    </motion.div>
  )
}
