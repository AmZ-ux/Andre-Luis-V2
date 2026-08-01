import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: boolean
  hover?: boolean
}

export function Card({ children, className, padding = true, hover = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800',
        padding && 'p-5 sm:p-6',
        hover && 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-300',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
