import { useState } from 'react'
import { cn } from '../../utils/cn'
import type { AvatarSize } from '../../types'

interface AvatarProps {
  src?: string
  alt?: string
  initials?: string
  size?: AvatarSize
  className?: string
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ src, alt = '', initials, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = useState(false)

  if (!src || imgError) {
    return (
      <div
        className={cn(
          'relative inline-flex items-center justify-center rounded-full',
          'bg-primary/10 text-primary font-semibold shrink-0',
          sizeStyles[size],
          className
        )}
        role="img"
        aria-label={alt || initials}
      >
        {initials && <span>{initials}</span>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full overflow-hidden',
        'bg-primary/10 text-primary font-semibold shrink-0',
        sizeStyles[size],
        className
      )}
      role="img"
      aria-label={alt || initials}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  )
}
