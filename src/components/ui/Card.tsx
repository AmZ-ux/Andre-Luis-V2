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
        'bg-white dark:bg-gray-900 rounded-2xl shadow-card',
        padding && 'p-5 sm:p-6',
        hover && 'hover:shadow-pop transition-all duration-200',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}