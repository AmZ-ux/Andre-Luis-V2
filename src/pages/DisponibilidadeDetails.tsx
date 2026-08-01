import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { motion } from 'framer-motion'
import { availabilityService } from '../services/availabilityService'
import { availabilityHistory } from '../services/availabilityHistory'
import { availabilityRules } from '../services/availabilityRules'
import { AvailabilityStatusBadge } from '../components/availability/AvailabilityStatusBadge'
import { CancelAvailabilityModal } from '../components/availability/CancelAvailabilityModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useToast } from '../contexts/ToastContext'
import { ArrowLeft, User, Calendar, Clock, FileText, Building2, AlertCircle } from 'lucide-react'
import type { Availability, AvailabilityHistoryEntry } from '../types/availability'

const typeLabels: Record<string, string> = { vacation: 'Férias' }

const actionLabels: Record<string, string> = {
  created: 'Período cadastrado',
  updated: 'Período editado',
  cancelled: 'Período cancelado',
  finished: 'Período finalizado',
}

export function DisponibilidadeDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [av, setAv] = useState<Availability | null>(null)
  const [history, setHistory] = useState<AvailabilityHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      availabilityService.getById(id),
      availabilityHistory.getByAvailabilityId(id),
    ])
      .then(([a, h]) => {
        if (!a) setError(true)
        else { setAv(a); setHistory(h) }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleCancel = async (reason: string) => {
    if (!av || !user) return
    try {
      const updated = await availabilityService.cancel(av.id, reason, user.name, user.id)
      setAv(updated)
      setShowCancel(false)
      const h = await availabilityHistory.getByAvailabilityId(av.id)
      setHistory(h)
      addToast('success', 'Período cancelado com sucesso!')
    } catch {
      addToast('error', 'Erro ao cancelar período')
    }
  }

  if (loading) return <PageSpinner />
  if (error || !av) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-text">Período não encontrado</h2>
        <Button onClick={() => navigate('/passageiros?tab=disponibilidade')} className="mt-4">Voltar</Button>
      </div>
    )
  }

  const days = availabilityRules.calculateDays(av.startDate, av.endDate)
  const canCancel = availabilityRules.canCancel(av)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-light transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">Detalhes do Período</h1>
          <p className="text-sm text-gray-500 mt-1">{typeLabels[av.type] || av.type}</p>
        </div>
        <AvailabilityStatusBadge status={av.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Passageiro
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Nome</p><p className="text-sm text-text">{av.passengerName}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">CPF</p><p className="text-sm text-text">{av.cpf}</p></div>
            </div>
            {av.institution && (
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div><p className="text-xs text-gray-400">Instituição</p><p className="text-sm text-text">{av.institution}</p></div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Período
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Data inicial</p><p className="text-sm text-text">{av.startDate}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Data final</p><p className="text-sm text-text">{av.endDate}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Duração</p><p className="text-sm text-text">{days} {days === 1 ? 'dia' : 'dias'}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-xs text-gray-400">Status</p><AvailabilityStatusBadge status={av.status} /></div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Motivo
        </h2>
        <p className="text-sm text-text">{av.reason}</p>
        {av.notes && <p className="text-sm text-gray-500 mt-2">{av.notes}</p>}
      </Card>

      {av.cancellationReason && (
        <Card>
          <h2 className="text-sm font-bold text-text mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-error" /> Motivo do Cancelamento
          </h2>
          <p className="text-sm text-text">{av.cancellationReason}</p>
          {av.cancelledAt && <p className="text-xs text-gray-400 mt-1">Cancelado em {av.cancelledAt}</p>}
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-bold text-text mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Histórico
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum registro</p>
        ) : (
          <div className="space-y-0">
            {history.map((entry, i) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary mt-1.5" />
                  {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-text">{actionLabels[entry.action] || entry.action}</p>
                  {entry.notes && <p className="text-xs text-gray-500">{entry.notes}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.performedBy} — {entry.createdAt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {canCancel && (
        <div className="flex justify-center">
          <Button variant="danger" onClick={() => setShowCancel(true)}>
            Cancelar Período
          </Button>
        </div>
      )}

      <CancelAvailabilityModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        availability={av}
      />
    </motion.div>
  )
}
