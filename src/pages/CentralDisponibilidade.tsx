import { useState, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAvailability } from '../hooks/useAvailability'
import { AvailabilitySummary } from '../components/availability/AvailabilitySummary'
import { AvailabilityList } from '../components/availability/AvailabilityList'
import { AvailabilityCard } from '../components/availability/AvailabilityCard'
import { AvailabilityFiltersPanel } from '../components/availability/AvailabilityFilters'
import { CancelAvailabilityModal } from '../components/availability/CancelAvailabilityModal'
import { ViewToggle } from '../components/passengers/ViewToggle'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useToast } from '../contexts/ToastContext'
import { useIsMobile } from '../hooks/useBreakpoint'
import { Search } from 'lucide-react'
import { Pagination } from '../components/ui/Pagination'
import { PageHeader } from '../components/ui/PageHeader'
import { SkeletonTable } from '../components/ui/Skeleton'
import type { Availability } from '../types/availability'
import type { ViewMode } from '../types/passenger'

export function DisponibilidadeSection({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const {
    availabilities, summary, loading, error, filters, sort, pagination, totalPages,
    updateFilters, resetFilters, setPage, setSortField, cancelAvailability, reload,
  } = useAvailability()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const isMobile = useIsMobile()
  const [cancelling, setCancelling] = useState<Availability | null>(null)

  const handleCancel = useCallback((av: Availability) => {
    setCancelling(av)
  }, [])

  const handleCancelConfirm = useCallback(async (reason: string) => {
    if (!cancelling || !user) return
    try {
      await cancelAvailability(cancelling.id, reason, user.name, user.id)
      addToast('success', 'Período cancelado com sucesso!')
      setCancelling(null)
    } catch {
      addToast('error', 'Erro ao cancelar período')
    }
  }, [cancelling, user, cancelAvailability, addToast])

  if (loading && availabilities.length === 0) {
    return (
      <div className="space-y-6">
        {!embedded && <PageHeader eyebrow="Operação" title="Disponibilidade" subtitle="Acompanhe os períodos de ausência dos passageiros" />}
        <SkeletonTable />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <Button onClick={reload}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {!embedded && (
        <PageHeader eyebrow="Operação" title="Disponibilidade" subtitle="Acompanhe os períodos de ausência dos passageiros" />
      )}

      <AvailabilitySummary summary={summary} />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder="Buscar por nome, CPF, instituição..."
            className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 text-sm text-text dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <AvailabilityFiltersPanel filters={filters} onChange={updateFilters} onReset={resetFilters} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {viewMode === 'list' && !isMobile ? (
        <Card padding={false} className="overflow-hidden">
          <AvailabilityList
            availabilities={availabilities}
            sort={sort}
            onSort={setSortField}
            onCancel={handleCancel}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {availabilities.map((av, i) => (
            <AvailabilityCard key={av.id} availability={av} index={i} onCancel={handleCancel} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <CancelAvailabilityModal
        isOpen={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={handleCancelConfirm}
        availability={cancelling}
      />
    </div>
  )
}
