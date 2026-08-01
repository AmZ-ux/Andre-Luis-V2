import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SectionTitleProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function SectionTitle({ title, subtitle, action, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-end justify-between mb-4', className)}>
      <div>
        <h2 className="text-base sm:text-lg font-bold text-text">{title}</h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
