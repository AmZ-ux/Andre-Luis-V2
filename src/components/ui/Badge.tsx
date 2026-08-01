import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import type { BadgeVariant } from '../../types'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const badgeVariants: Record<BadgeVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  neutral: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
}

export function Badge({ variant = 'primary', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
