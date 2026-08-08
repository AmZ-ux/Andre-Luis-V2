import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { motion } from 'framer-motion'
import { availabilityService } from '../services/availabilityService'
import { AvailabilityStatusBadge } from '../components/availability/AvailabilityStatusBadge'
import { AvailabilityForm } from '../components/availability/AvailabilityForm'
import { CancelAvailabilityModal } from '../components/availability/CancelAvailabilityModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageSpinner } from '../components/ui/Spinner'
import { useToast } from '../contexts/ToastContext'
import { Plus, Calendar, Clock } from 'lucide-react'
import { availabilityRules } from '../services/availabilityRules'
import type { Availability, AvailabilityFormData } from '../types/availability'

export function MinhaDisponibilidade({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState<Availability | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await availabilityService.getByPassengerId(user.id)
      setAvailabilities(data)
    } catch {
      setLoadError('Erro ao carregar dados de disponibilidade')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async (data: AvailabilityFormData) => {
    if (!user) return
    setSubmitting(true)
    try {
      await availabilityService.create({
        ...data,
        passengerId: user.id,
        passengerName: user.name,
        cpf: user.cpf,
        transportType: 'university',
        submittedBy: user.name,
        submittedById: user.id,
      })
      addToast('success', 'Período cadastrado com sucesso!')
      setShowForm(false)
      await load()
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Erro ao cadastrar período')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (reason: string) => {
    if (!cancelling || !user) return
    try {
      await availabilityService.cancel(cancelling.id, reason, user.name, user.id)
      addToast('success', 'Período cancelado com sucesso!')
      setCancelling(null)
      await load()
    } catch {
      addToast('error', 'Erro ao cancelar período')
    }
  }

  if (loading) return <PageSpinner />

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-error/10 flex items-center justify-center mb-4">
          <span className="text-2xl text-error">!</span>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Erro ao carregar</h2>
        <p className="text-sm text-gray-500 mb-6">{loadError}</p>
        <button onClick={load} className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`space-y-6 ${embedded ? '' : 'max-w-3xl mx-auto'}`}>
      {!embedded && (
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Minha Disponibilidade</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seus períodos de ausência</p>
        </div>
      )}
      {!showForm && (
        <div className="flex justify-end">
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
            Novo Período
          </Button>
        </div>
      )}

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text">Cadastrar Período de Ausência</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-400 hover:text-text transition-colors"
            >
              Cancelar
            </button>
          </div>
          <AvailabilityForm onSubmit={handleSubmit} loading={submitting} onCancel={() => setShowForm(false)} />
        </Card>
      )}

      {availabilities.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-12">
            <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum período de ausência cadastrado</p>
            <Button variant="secondary" className="mt-4" onClick={() => setShowForm(true)}>
              Cadastrar Período
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {availabilities.map((av, i) => {
            const days = availabilityRules.calculateDays(av.startDate, av.endDate)
            const canCancel = availabilityRules.canCancel(av)
            return (
              <motion.div
                key={av.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">Férias</span>
                      <AvailabilityStatusBadge status={av.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {av.startDate} — {av.endDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {days} {days === 1 ? 'dia' : 'dias'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{av.reason}</p>
                    {av.notes && <p className="text-xs text-gray-400">{av.notes}</p>}
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => setCancelling(av)}
                      className="text-xs font-medium text-error hover:text-red-600 transition-colors shrink-0"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <CancelAvailabilityModal
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={handleCancel}
        availability={cancelling}
      />
    </motion.div>
  )
}
