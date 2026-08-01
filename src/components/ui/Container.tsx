import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface ContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const maxWidths = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1440px]',
  full: 'max-w-full',
}

export function Container({ children, className, maxWidth = 'lg' }: ContainerProps) {
  return (
    <div className={cn('mx-auto px-4 sm:px-6 lg:px-8 w-full', maxWidths[maxWidth], className)}>
      {children}
    </div>
  )
}
