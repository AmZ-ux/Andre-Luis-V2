import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { statusOptions, transportTypeOptions } from '../../validators/passengerValidators'
import type { PassengerFilters } from '../../types/passenger'
import { cn } from '../../utils/cn'

interface FiltersPanelProps {
  filters: PassengerFilters
  onChange: (updates: Partial<PassengerFilters>) => void
  onReset: () => void
}

export function FiltersPanel({ filters, onChange, onReset }: FiltersPanelProps) {
  const [open, setOpen] = useState(false)

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Filtros"
          aria-expanded={open}
          className={cn(
            'relative h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-colors',
            hasActiveFilters || open
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 shadow-card'
          )}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold border-2 border-secondary dark:border-gray-950">
              {Object.values(filters).filter((v) => v !== '').length}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs text-primary hover:text-primary-light font-medium transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-5 mt-3 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text">Filtros</p>
                <button
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                  aria-label="Fechar filtros"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label="Cidade"
                  placeholder="Filtrar por cidade"
                  value={filters.city}
                  onChange={(e) => onChange({ city: e.target.value })}
                />
                <Select
                  label="Status"
                  options={statusOptions}
                  value={filters.status}
                  onChange={(e) => onChange({ status: e.target.value as PassengerFilters['status'] })}
                  placeholder="Todos"
                />
                <Select
                  label="Tipo de Transporte"
                  options={transportTypeOptions}
                  value={filters.transportType}
                  onChange={(e) => onChange({ transportType: e.target.value as PassengerFilters['transportType'] })}
                  placeholder="Todos"
                />
                <Input
                  label="Dia Vencimento"
                  placeholder="Ex: 15"
                  value={filters.dueDay}
                  onChange={(e) => onChange({ dueDay: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
                <Input
                  label="Instituição"
                  placeholder="Filtrar por instituição"
                  value={filters.institution}
                  onChange={(e) => onChange({ institution: e.target.value })}
                />
                <Input
                  label="Empresa"
                  placeholder="Filtrar por empresa"
                  value={filters.company}
                  onChange={(e) => onChange({ company: e.target.value })}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
