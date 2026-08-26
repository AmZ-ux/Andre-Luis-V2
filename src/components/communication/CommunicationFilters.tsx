import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Filter, RotateCcw } from 'lucide-react'
import type { CommunicationFilters as FiltersType } from '../../types/communication'

const typeOptions = [
  { value: '', label: 'Todos' },
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Grupo' },
  { value: 'all', label: 'Todos' },
]

const channelFilterOptions = [
  { value: '', label: 'Todos' },
  { value: 'app', label: 'Aplicativo' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
]

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'failed', label: 'Com erro' },
  { value: 'cancelled', label: 'Canceladas' },
]

interface CommunicationFiltersProps {
  filters: FiltersType
  onChange: (filters: FiltersType) => void
}

export function CommunicationFilters({ filters, onChange }: CommunicationFiltersProps) {
  const update = (key: keyof FiltersType, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const reset = () => {
    onChange({ period: 'all', type: '', channel: '', status: '', search: '' })
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <Filter className="h-4 w-4 text-primary" />
          Filtros
        </div>
        <Button variant="ghost" size="sm" onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'today', label: 'Hoje' },
            { value: 'week', label: 'Esta semana' },
            { value: 'month', label: 'Este mês' },
          ]}
          placeholder="Período"
          value={filters.period}
          onChange={(e) => update('period', e.target.value)}
        />
        <Select
          options={typeOptions}
          placeholder="Tipo"
          value={filters.type}
          onChange={(e) => update('type', e.target.value)}
        />
        <Select
          options={channelFilterOptions}
          placeholder="Canal"
          value={filters.channel}
          onChange={(e) => update('channel', e.target.value)}
        />
        <Select
          options={statusOptions}
          placeholder="Status"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
        />
      </div>
    </div>
  )
}
