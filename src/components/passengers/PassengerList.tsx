import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PassengerAvatar } from './PassengerAvatar'
import { PassengerStatusBadge } from './PassengerStatusBadge'
import { Eye, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useIsMobile } from '../../hooks/useBreakpoint'
import { PassengerCard } from './PassengerCard'
import type { Passenger, SortState, ViewMode } from '../../types/passenger'

interface PassengerListProps {
  passengers: Passenger[]
  viewMode: ViewMode
  sort: SortState
  onSort: (field: SortState['field']) => void
  onEdit: (p: Passenger) => void
  onDelete: (p: Passenger) => void
}

const typeLabel: Record<string, string> = {
  university: 'Universitário',
  school: 'Escolar',
  contract: 'Contrato',
}

const columns = [
  { key: 'name', label: 'Nome', sortable: true, field: 'name' as const },
  { key: 'cpf', label: 'CPF', sortable: false },
  { key: 'phone', label: 'Telefone', sortable: false },
  { key: 'city', label: 'Cidade', sortable: true, field: 'city' as const },
  { key: 'type', label: 'Tipo', sortable: false },
  { key: 'fee', label: 'Mensalidade', sortable: true, field: 'monthlyFee' as const },
  { key: 'dueDay', label: 'Vencimento', sortable: true, field: 'dueDay' as const },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'actions', label: '', sortable: false },
]

export function PassengerList({ passengers, viewMode, sort, onSort, onEdit, onDelete }: PassengerListProps) {
  const navigate = useNavigate()

  const isMobile = useIsMobile()

  if (viewMode === 'cards' || isMobile) {
    return (
      <div className="space-y-3">
        {passengers.map((p, i) => (
          <PassengerCard key={p.id} passenger={p} onEdit={onEdit} onDelete={onDelete} index={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
            <th className="px-4 py-2.5 text-left w-12" />
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap',
                  col.sortable && 'cursor-pointer hover:text-text select-none'
                )}
                onClick={() => col.sortable && col.field && onSort(col.field)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && col.field === sort.field && (
                    sort.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {passengers.map((p, i) => (
            <motion.tr
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.02 }}
              className="border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
            >
              <td className="px-4 py-3">
                <PassengerAvatar name={p.name} size="sm" />
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => navigate(`/passageiros/${p.id}`)}
                  className="text-sm font-medium text-text hover:text-primary transition-colors"
                >
                  {p.name}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{p.cpf}</td>
              <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{p.phone}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {p.address.city}/{p.address.state}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">{typeLabel[p.transportType]}</td>
              <td className="px-4 py-3 text-sm font-semibold text-text tabular-nums">
                R$ {p.monthlyFee.toFixed(2).replace('.', ',')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">Dia {p.dueDay}</td>
              <td className="px-4 py-3">
                <PassengerStatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate(`/passageiros/${p.id}`)}
                    className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                    aria-label="Visualizar"
                  >
                    <Eye className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => onEdit(p)}
                    className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => onDelete(p)}
                    className="h-9 w-9 rounded-lg hover:bg-error-soft flex items-center justify-center transition-colors"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-error" />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
