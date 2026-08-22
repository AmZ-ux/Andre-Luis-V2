import { motion } from 'framer-motion'
import type { AvailabilitySummary as Summary } from '../../types/availability'

interface AvailabilitySummaryProps {
  summary: Summary
}

export function AvailabilitySummary({ summary }: AvailabilitySummaryProps) {
  const items = [
    { label: 'Em férias', value: summary.onVacation, color: 'text-success', bg: 'bg-success-soft border-success/20' },
    { label: 'Retornam hoje', value: summary.returningToday, color: 'text-primary', bg: 'bg-primary-soft border-primary/20' },
    { label: 'Iniciam hoje', value: summary.startingToday, color: 'text-warning', bg: 'bg-warning-soft border-warning/20' },
    { label: 'Futuros', value: summary.future, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`rounded-xl border p-4 ${item.bg}`}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${item.color}`}>{item.value}</p>
        </motion.div>
      ))}
    </div>
  )
}
