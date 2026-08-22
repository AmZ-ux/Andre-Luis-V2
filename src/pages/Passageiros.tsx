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
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Pagination } from '../components/ui/Pagination'
import { SkeletonTable } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { passengerService } from '../services/passengerService'
import { Users, CalendarOff } from 'lucide-react'
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
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null)
  const [deletingPassenger, setDeletingPassenger] = useState<Passenger | null>(null)
  const [deleting, setDeleting] = useState(false)

  const tab = searchParams.get('tab') === 'disponibilidade' ? 'disponibilidade' : 'passageiros'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'passageiros' ? {} : { tab: key }, { replace: true })
  }

  const handleEdit = (p: Passenger) => {
    setEditingPassenger(p)
  }

  const handleSave = async (data: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingPassenger) return
    await passengerService.update(editingPassenger.id, data as unknown as Partial<Passenger>)
    addToast('success', 'Passageiro atualizado com sucesso!')
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
        <PageHeader className="hidden sm:block" eyebrow="Cadastro" title="Passageiros" subtitle="Gerencie os passageiros cadastrados" />
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <SkeletonTable />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <PageHeader className="hidden sm:block" eyebrow="Cadastro" title="Passageiros" subtitle="Gerencie os passageiros cadastrados" />
        <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />
        <EmptyPassengers type="error" onAction={reload} actionLabel="Tentar novamente" />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        className="hidden sm:block"
        eyebrow="Cadastro"
        title="Passageiros"
        subtitle={
          tab === 'disponibilidade'
            ? 'Acompanhe os períodos de ausência dos passageiros'
            : 'Gerencie os passageiros cadastrados'
        }
      />

      <PageTabs tabs={tabs} value={tab} onChange={handleTabChange} />

      {tab === 'disponibilidade' ? (
        <DisponibilidadeSection embedded />
      ) : (
        <>
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
            onAction={filters.search ? resetFilters : reload}
            actionLabel={filters.search ? 'Limpar pesquisa' : 'Atualizar'}
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
        <Pagination
          page={pagination.page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <PassengerForm
        isOpen={!!editingPassenger}
        onClose={() => setEditingPassenger(null)}
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
