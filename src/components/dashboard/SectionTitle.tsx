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
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}