import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Statistic } from '../../types/dashboard'

interface StatisticCardProps {
  data: Statistic
  index: number
}

const valueColors: Record<string, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

export function StatisticCard({ data, index }: StatisticCardProps) {
  void index
  return (
    <div className="px-5 py-5 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 truncate">
          {data.title}
        </p>
        <p className={cn('text-[26px] font-bold tracking-tight tabular-nums mt-1', valueColors[data.color] || 'text-text')}>
          {data.value}
        </p>
      </div>
      <div
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0',
          data.changeType === 'increase' ? 'bg-success-soft text-success' : 'bg-error-soft text-error'
        )}
        title={data.description}
      >
        {data.changeType === 'increase' ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span className="tabular-nums">{data.change}%</span>
      </div>
    </div>
  )
}