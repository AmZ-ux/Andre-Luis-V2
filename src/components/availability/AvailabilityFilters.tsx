import { useState } from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { availabilityStatusOptions } from './AvailabilityStatusBadge'
import type { AvailabilityFilters } from '../../types/availability'
import type { TransportType } from '../../types/passenger'
import { cn } from '../../utils/cn'

interface AvailabilityFiltersPanelProps {
  filters: AvailabilityFilters
  onChange: (updates: Partial<AvailabilityFilters>) => void
  onReset: () => void
}

const transportOptions: { value: TransportType | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'university', label: 'Universitário' },
  { value: 'school', label: 'Escolar' },
  { value: 'contract', label: 'Contrato' },
]

const typeOptions = [
  { value: '', label: 'Todos os tipos' },
  { value: 'vacation', label: 'Férias' },
]

export function AvailabilityFiltersPanel({ filters, onChange, onReset }: AvailabilityFiltersPanelProps) {
  const [open, setOpen] = useState(false)

  const activeCount = Object.values(filters).filter((v) => v !== '' && v != null).length

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Filtros"
        aria-expanded={open}
        className={cn(
          'relative h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors',
          activeCount > 0 || open
            ? 'bg-primary text-white shadow-lg shadow-primary/30'
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-card'
        )}
      >
        <SlidersHorizontal className="h-5 w-5" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold border-2 border-secondary dark:border-gray-950">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select
                  options={typeOptions}
                  value={filters.type}
                  onChange={(e) => onChange({ type: e.target.value as AvailabilityFilters['type'] })}
                  placeholder="Tipo"
                />
                <Select
                  options={availabilityStatusOptions}
                  value={filters.status}
                  onChange={(e) => onChange({ status: e.target.value as AvailabilityFilters['status'] })}
                  placeholder="Status"
                />
                <Select
                  options={transportOptions}
                  value={filters.transportType}
                  onChange={(e) => onChange({ transportType: e.target.value as AvailabilityFilters['transportType'] })}
                  placeholder="Transporte"
                />
                <Input
                  label="Data início"
                  type="date"
                  value={filters.periodStart}
                  onChange={(e) => onChange({ periodStart: e.target.value })}
                />
                <Input
                  label="Data fim"
                  type="date"
                  value={filters.periodEnd}
                  onChange={(e) => onChange({ periodEnd: e.target.value })}
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
