import { motion } from 'framer-motion'
import type { AvailabilitySummary as Summary } from '../../types/availability'

interface AvailabilitySummaryProps {
  summary: Summary
}

export function AvailabilitySummary({ summary }: AvailabilitySummaryProps) {
  const items = [
    { label: 'Em férias', value: summary.onVacation, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/20' },
    { label: 'Retornam hoje', value: summary.returningToday, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/20' },
    { label: 'Iniciam hoje', value: summary.startingToday, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/20' },
    { label: 'Futuros', value: summary.future, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className={`rounded-2xl border p-4 ${item.bg}`}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
        </motion.div>
      ))}
    </div>
  )
}
