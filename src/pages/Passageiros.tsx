import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePassengers } from '../hooks/usePassengers'
import { SearchInput } from '../components/passengers/SearchInput'
import { FiltersPanel } from '../components/passengers/FiltersPanel'
import { PassengerList } from '../components/passengers/PassengerList'
import { PassengerForm } from '../components/passengers/PassengerForm'
import { PassengerCard } from '../components/passengers/PassengerCard'
import { DeleteModal } from '../components/passengers/DeleteModal'
import { EmptyPassengers } from '../components/passengers/EmptyPassengers'
import { ViewToggle } from '../components/passengers/ViewToggle'
import { DisponibilidadeSection } from './CentralDisponibilidade'
import { PageTabs } from '../components/ui/PageTabs'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useToast } from '../contexts/ToastContext'
import { passengerService } from '../services/passengerService'
import { Plus, ChevronLeft, ChevronRight, Users, CalendarOff } from 'lucide-react'
import { cn } from '../utils/cn'
import type { Passenger, ViewMode } from '../types/passenger'

const tabs = [
  { key: 'passageiros', label: 'Passageiros', icon: Users },
  { key: 'disponibilidade', label: 'Disponibilidade', icon: CalendarOff },
]

export function Passageiros() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    passengers, loading, error, filters, sort, pagination, totalPages,
    updateFilters, resetFilters, setPage, setSortField, removePassenger, reload,
  } = usePassengers()
  const { addToast } = useToast()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [formOpen, setFormOpen] = useState(false)
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null)
  const [deletingPassenger, setDeletingPassenger] = useState<Passenger | null>(null)
  const [deleting, setDeleting] = useState(false)

  const tab = searchParams.get('tab') === 'disponibilidade' ? 'disponibilidade' : 'passageiros'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'passageiros' ? {} : { tab: key }, { replace: true })
  }

  const handleNew = () => {
    setEditingPassenger(null)
    setFormOpen(true)
  }

  const handleEdit = (p: Passenger) => {
    setEditingPassenger(p)
    setFormOpen(true)
  }

  const handleSave = async (data: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingPassenger) {
      await passengerService.update(editingPassenger.id, data as unknown as Partial<Passenger>)
      addToast('success', 'Passageiro atualizado com sucesso!')
    } else {
      await passengerService.create(data)
      addToast('success', 'Passageiro cadastrado com sucesso!')
    }
    reload()
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPassenger) return
    setDeleting(true)
    try {
      await removePassenger(deletingPassenger.id)
      addToast('success', 'Passageiro excluído com sucesso!')
      setDeletingPassenger(null)
    } catch {
      addToast('error', 'Erro ao excluir passageiro')
    } finally {
      setDeleting(false)
    }
  }

  if (loading && passengers.length === 0) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Passageiros</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie os passageiros cadastrados</p>
          </div>
        </div>
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text">Passageiros</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie os passageiros cadastrados</p>
          </div>
        </div>
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <EmptyPassengers type="error" onAction={reload} actionLabel="Tentar novamente" />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Passageiros</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tab === 'disponibilidade'
            ? 'Acompanhe os períodos de ausência dos passageiros'
            : 'Gerencie os passageiros cadastrados'}
        </p>
      </div>

      <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />

      {tab === 'disponibilidade' ? (
        <DisponibilidadeSection embedded />
      ) : (
        <>
      <div className="flex justify-end">
        <Button onClick={handleNew} icon={<Plus className="h-4 w-4" />}>
          Novo Passageiro
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={filters.search}
          onChange={(v) => updateFilters({ search: v })}
          className="flex-1"
        />
        <div className="flex items-center gap-3">
          <FiltersPanel filters={filters} onChange={updateFilters} onReset={resetFilters} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {passengers.length === 0 ? (
        <Card>
          <EmptyPassengers
            type={filters.search || Object.values(filters).some((v) => v !== '') ? 'not-found' : 'empty'}
            onAction={filters.search ? resetFilters : handleNew}
            actionLabel={filters.search ? 'Limpar pesquisa' : 'Novo Passageiro'}
          />
        </Card>
      ) : viewMode === 'list' ? (
        <Card padding={false} className="overflow-hidden">
          <PassengerList
            passengers={passengers}
            viewMode="list"
            sort={sort}
            onSort={setSortField}
            onEdit={handleEdit}
            onDelete={setDeletingPassenger}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {viewMode === 'cards' && passengers.map((p, i) => (
            <PassengerCard key={p.id} passenger={p} onEdit={handleEdit} onDelete={setDeletingPassenger} index={i} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-5 w-5 text-text" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setPage(page)}
              className={cn(
                'min-w-[44px] h-11 rounded-xl text-sm font-medium transition-all',
                page === pagination.page
                  ? 'bg-primary text-white shadow-sm'
                  : 'border border-gray-200 dark:border-gray-700 text-text hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setPage(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
            className="h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-5 w-5 text-text" />
          </button>
        </div>
      )}

      <PassengerForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingPassenger(null) }}
        onSave={handleSave}
        editPassenger={editingPassenger}
      />

      <DeleteModal
        isOpen={!!deletingPassenger}
        onClose={() => setDeletingPassenger(null)}
        onConfirm={handleDeleteConfirm}
        passengerName={deletingPassenger?.name || ''}
        loading={deleting}
      />
        </>
      )}
    </div>
  )
}
