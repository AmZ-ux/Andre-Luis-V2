import { useState } from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { receiptStatusOptions } from './ReceiptStatus'
import type { ReceiptFilters } from '../../types/receipt'
import type { TransportType } from '../../types/passenger'

interface ReceiptFiltersPanelProps {
  filters: ReceiptFilters
  onChange: (updates: Partial<ReceiptFilters>) => void
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

export function ReceiptFiltersPanel({ filters, onChange, onReset }: ReceiptFiltersPanelProps) {
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  options={receiptStatusOptions}
                  value={filters.status}
                  onChange={(e) => onChange({ status: e.target.value as ReceiptFilters['status'] })}
                  placeholder="Status"
                />
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
                  options={transportOptions}
                  value={filters.transportType}
                  onChange={(e) => onChange({ transportType: e.target.value as ReceiptFilters['transportType'] })}
                  placeholder="Tipo"
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
