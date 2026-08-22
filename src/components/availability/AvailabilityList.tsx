import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AvailabilityStatusBadge } from './AvailabilityStatusBadge'
import { ChevronUp, ChevronDown, XCircle } from 'lucide-react'
import { availabilityRules } from '../../services/availabilityRules'
import { cn } from '../../utils/cn'
import { useIsMobile } from '../../hooks/useBreakpoint'
import type { Availability, AvailabilitySort } from '../../types/availability'

interface AvailabilityListProps {
  availabilities: Availability[]
  sort: AvailabilitySort
  onSort: (field: AvailabilitySort['field']) => void
  onCancel: (av: Availability) => void
}

interface SortHeaderProps {
  label: string
  field: AvailabilitySort['field']
  current: AvailabilitySort
  onClick: (field: AvailabilitySort['field']) => void
}

function SortHeader({ label, field, current, onClick }: SortHeaderProps) {
  const active = current.field === field
  return (
    <button
      onClick={() => onClick(field)}
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'text-text' : 'text-gray-500 dark:text-gray-400 hover:text-text'
      )}
    >
      {label}
      <span className="inline-flex flex-col -space-y-1">
        <ChevronUp className={cn('h-3 w-3', active && current.direction === 'asc' ? 'text-primary' : 'text-gray-300')} />
        <ChevronDown className={cn('h-3 w-3', active && current.direction === 'desc' ? 'text-primary' : 'text-gray-300')} />
      </span>
    </button>
  )
}

const typeLabels: Record<string, string> = { vacation: 'Férias' }

export function AvailabilityList({ availabilities, sort, onSort, onCancel }: AvailabilityListProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  if (availabilities.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-400">Nenhum período encontrado</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {availabilities.map((av, i) => {
          const days = availabilityRules.calculateDays(av.startDate, av.endDate)
          const canCancel = availabilityRules.canCancel(av)
          return (
            <motion.div
              key={av.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => navigate(`/disponibilidade/${av.id}`)}
                  className="text-base font-semibold text-text hover:text-primary transition-colors text-left min-w-0"
                >
                  {av.passengerName}
                </button>
                <AvailabilityStatusBadge status={av.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>
                  <p className="text-gray-400">Tipo</p>
                  <p className="text-sm text-text">{typeLabels[av.type] || av.type}</p>
                </div>
                <div>
                  <p className="text-gray-400">Dias</p>
                  <p className="text-sm text-text">{days}</p>
                </div>
                <div>
                  <p className="text-gray-400">Início</p>
                  <p className="text-sm text-text">{av.startDate}</p>
                </div>
                <div>
                  <p className="text-gray-400">Fim</p>
                  <p className="text-sm text-text">{av.endDate}</p>
                </div>
              </div>

              <div className="flex items-center justify-end mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                {canCancel && (
                  <button
                    onClick={() => onCancel(av)}
                    className="h-11 w-11 rounded-lg flex items-center justify-center text-gray-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    aria-label="Cancelar"
                    title="Cancelar"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-4 py-3 text-left">
              <SortHeader label="Passageiro" field="passengerName" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-left">Tipo</th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Início" field="startDate" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">
              <SortHeader label="Fim" field="endDate" current={sort} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-center">Dias</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {availabilities.map((av) => {
            const days = availabilityRules.calculateDays(av.startDate, av.endDate)
            const canCancel = availabilityRules.canCancel(av)
            return (
              <tr
                key={av.id}
                className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => navigate(`/disponibilidade/${av.id}`)}
                    className="text-sm font-medium text-text hover:text-primary transition-colors"
                  >
                    {av.passengerName}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-text">{typeLabels[av.type] || av.type}</td>
                <td className="px-4 py-3 text-center text-sm text-text">{av.startDate}</td>
                <td className="px-4 py-3 text-center text-sm text-text">{av.endDate}</td>
                <td className="px-4 py-3 text-center text-sm text-text">{days}</td>
                <td className="px-4 py-3 text-center">
                  <AvailabilityStatusBadge status={av.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {canCancel && (
                      <button
                        onClick={() => onCancel(av)}
                        className="h-11 w-11 rounded-lg flex items-center justify-center text-gray-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        aria-label="Cancelar"
                        title="Cancelar"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
