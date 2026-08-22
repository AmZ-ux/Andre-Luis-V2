import { cn } from '../../utils/cn'
import type { SkeletonVariant } from '../../types'

interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({ variant = 'text', width, height, className }: SkeletonProps) {
  const baseClass = 'bg-gray-200 dark:bg-gray-700 animate-[skeleton-pulse_1.5s_ease-in-out_infinite] rounded-lg'

  if (variant === 'circle') {
    return (
      <div
        className={cn(baseClass, 'rounded-full', className)}
        style={{
          width: width || 40,
          height: height || 40,
        }}
        aria-hidden="true"
      />
    )
  }

  if (variant === 'rect') {
    return (
      <div
        className={cn(baseClass, className)}
        style={{
          width: width || '100%',
          height: height || 120,
        }}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={cn(baseClass, 'h-4 w-full', className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 space-y-4">
      <Skeleton variant="rect" height={20} width="40%" />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="60%" />
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-4">
      <div className="flex gap-4">
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="25%" />
        <Skeleton variant="text" width="25%" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="text" width="25%" />
          <Skeleton variant="text" width="25%" />
        </div>
      ))}
    </div>
  )
}
