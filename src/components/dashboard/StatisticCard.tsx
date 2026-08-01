import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import * as Icons from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Statistic } from '../../types/dashboard'
import type { ReactNode } from 'react'

interface StatisticCardProps {
  data: Statistic
  index: number
}

const colorMap: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
}

function IconRenderer({ name, className }: { name: string; className?: string }) {
  const Icon = Icons[name as keyof typeof Icons] as React.ComponentType<{ className?: string }> | undefined
  if (!Icon) return null
  return <Icon className={className} />
}

export function StatisticCard({ data, index }: StatisticCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all duration-300"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">
            {data.title}
          </p>
          <p className="text-xl sm:text-2xl font-bold text-text">{data.value}</p>
          <p className="text-xs text-gray-400 truncate">{data.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
          <div
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              colorMap[data.color] || colorMap.primary
            )}
          >
            <IconRenderer name={data.icon} className="h-5 w-5" />
          </div>
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              data.changeType === 'increase' ? 'text-success' : 'text-error'
            )}
          >
            {data.changeType === 'increase' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{data.change}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
