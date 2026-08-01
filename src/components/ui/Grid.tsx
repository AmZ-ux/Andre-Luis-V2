import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface GridProps {
  children: ReactNode
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: number
  className?: string
}

const colMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
} as const

const gapMap: Record<number, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12',
}

export function Grid({ children, cols, gap = 4, className }: GridProps) {
  const classes = cn(
    'grid',
    cols?.default && colMap[cols.default as keyof typeof colMap],
    cols?.sm && `sm:${colMap[cols.sm as keyof typeof colMap]}`,
    cols?.md && `md:${colMap[cols.md as keyof typeof colMap]}`,
    cols?.lg && `lg:${colMap[cols.lg as keyof typeof colMap]}`,
    cols?.xl && `xl:${colMap[cols.xl as keyof typeof colMap]}`,
    gapMap[gap],
    className
  )

  return <div className={classes}>{children}</div>
}
