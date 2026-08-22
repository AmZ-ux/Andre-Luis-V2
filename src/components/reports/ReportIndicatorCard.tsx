import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { ReportIndicator } from '../../types/reports'

interface ReportIndicatorCardProps {
  indicator: ReportIndicator
  index: number
}

export function ReportIndicatorCard({ indicator, index }: ReportIndicatorCardProps) {
  const ChangeIcon = indicator.changeType === 'positive'
    ? TrendingUp
    : indicator.changeType === 'negative'
    ? TrendingDown
    : Minus

  const changeColor = indicator.changeType === 'positive'
    ? 'text-success'
    : indicator.changeType === 'negative'
    ? 'text-error'
    : 'text-gray-400'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4"
    >
      <div className="space-y-1.5">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{indicator.label}</p>
        <p className="text-xl font-bold text-text">{indicator.value}</p>
        {indicator.change && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', changeColor)}>
            <ChangeIcon className="h-3 w-3" />
            <span>{indicator.change}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
