import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { AvailabilityStatusBadge } from './AvailabilityStatusBadge'
import { Calendar, XCircle } from 'lucide-react'
import { availabilityRules } from '../../services/availabilityRules'
import type { Availability } from '../../types/availability'

interface AvailabilityCardProps {
  availability: Availability
  index: number
  onCancel?: (av: Availability) => void
  showPassenger?: boolean
  canCancel?: boolean
}

const typeLabels: Record<string, string> = {
  vacation: 'Férias',
}

export function AvailabilityCard({
  availability: av,
  index,
  onCancel,
  showPassenger = true,
  canCancel: canCancelProp,
}: AvailabilityCardProps) {
  const navigate = useNavigate()
  const days = availabilityRules.calculateDays(av.startDate, av.endDate)
  const canCancel = canCancelProp ?? availabilityRules.canCancel(av)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {showPassenger && (
            <button
              onClick={() => navigate(`/disponibilidade/${av.id}`)}
              className="text-sm font-semibold text-text hover:text-primary transition-colors"
            >
              {av.passengerName}
            </button>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
              {typeLabels[av.type] || av.type}
            </span>
            <AvailabilityStatusBadge status={av.status} />
          </div>
        </div>
        {onCancel && canCancel && (
          <button
            onClick={() => onCancel(av)}
            className="h-11 w-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            aria-label="Cancelar"
            title="Cancelar"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {av.startDate} — {av.endDate}
        </span>
        <span className="font-medium text-text">{days} {days === 1 ? 'dia' : 'dias'}</span>
      </div>

      <p className="text-xs text-gray-500 line-clamp-2">{av.reason}</p>
    </motion.div>
  )
}
