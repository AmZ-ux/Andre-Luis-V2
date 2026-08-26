import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { Filter, RotateCcw } from 'lucide-react'
import type { ReportFilters as ReportFiltersType } from '../../types/reports'
import type { TransportType } from '../../types/passenger'

interface ReportFiltersComponentProps {
  filters: ReportFiltersType
  onChange: (filters: ReportFiltersType) => void
  onReset: () => void
  visible?: boolean
}

const transportOptions: { value: TransportType | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'university', label: 'Universitário' },
  { value: 'school', label: 'Escolar' },
  { value: 'contract', label: 'Contrato' },
]

const paymentOptions: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'credit', label: 'Cartão de Crédito' },
  { value: 'debit', label: 'Cartão de Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
]

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'pending', label: 'Pendente' },
  { value: 'overdue', label: 'Atrasado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'exempt', label: 'Isento' },
]

export function ReportFilters({ filters, onChange, onReset, visible = true }: ReportFiltersComponentProps) {
  if (!visible) return null

  const update = (key: keyof ReportFiltersType, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <Filter className="h-4 w-4 text-primary" />
          Filtros
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          options={[
            { value: 'month', label: 'Mensal' },
            { value: 'year', label: 'Anual' },
            { value: 'custom', label: 'Personalizado' },
          ]}
          placeholder="Período"
          value={filters.period}
          onChange={(e) => update('period', e.target.value)}
        />
        <Select
          options={Array.from({ length: 12 }, (_, i) => ({
            value: String(i + 1),
            label: new Date(0, i).toLocaleString('pt-BR', { month: 'long' }),
          }))}
          placeholder="Mês"
          value={filters.month}
          onChange={(e) => update('month', e.target.value)}
        />
        <Select
          options={[2026, 2025, 2024, 2023].map((y) => ({ value: String(y), label: String(y) }))}
          placeholder="Ano"
          value={filters.year}
          onChange={(e) => update('year', e.target.value)}
        />
        <Select
          options={transportOptions}
          placeholder="Tipo de Transporte"
          value={filters.transportType}
          onChange={(e) => update('transportType', e.target.value)}
        />
        <Select
          options={statusOptions}
          placeholder="Status"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
        />
        <Select
          options={paymentOptions}
          placeholder="Forma de Pagamento"
          value={filters.paymentMethod}
          onChange={(e) => update('paymentMethod', e.target.value)}
        />
      </div>
    </div>
  )
}
