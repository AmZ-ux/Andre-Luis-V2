import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { statusOptions } from './MonthlyFeeStatus'
import type { MonthlyFeeFilters } from '../../types/monthlyFee'
import type { TransportType } from '../../types/passenger'
import { useState } from 'react'

interface MonthlyFiltersProps {
  filters: MonthlyFeeFilters
  onChange: (updates: Partial<MonthlyFeeFilters>) => void
  onReset: () => void
}

const monthOptions = [
  { value: '', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const currentYear = new Date().getFullYear()
const yearOptions = [
  { value: '', label: 'Todos os anos' },
  ...Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => ({
    value: String(y),
    label: String(y),
  })),
]

const transportOptions: { value: TransportType | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'university', label: 'Universitário' },
  { value: 'school', label: 'Escolar' },
  { value: 'contract', label: 'Contrato' },
]

export function MonthlyFilters({ filters, onChange, onReset }: MonthlyFiltersProps) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        onClick={() => setOpen(!open)}
      >
        Filtros
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select
                  options={monthOptions}
                  value={filters.month}
                  onChange={(e) => onChange({ month: e.target.value })}
                  placeholder="Mês"
                />
                <Select
                  options={yearOptions}
                  value={filters.year}
                  onChange={(e) => onChange({ year: e.target.value })}
                  placeholder="Ano"
                />
                <Select
                  options={statusOptions}
                  value={filters.status}
                  onChange={(e) => onChange({ status: e.target.value as MonthlyFeeFilters['status'] })}
                  placeholder="Status"
                />
                <Select
                  options={transportOptions}
                  value={filters.transportType}
                  onChange={(e) => onChange({ transportType: e.target.value as MonthlyFeeFilters['transportType'] })}
                  placeholder="Tipo"
                />
                <Input
                  placeholder="Passageiro"
                  value={filters.passenger}
                  onChange={(e) => onChange({ passenger: e.target.value })}
                />
                <Input
                  placeholder="Dia vencimento início"
                  value={filters.dueDayStart}
                  onChange={(e) => onChange({ dueDayStart: e.target.value })}
                  type="number"
                  min={1}
                  max={31}
                />
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="h-4 w-4" />}
                  onClick={onReset}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
