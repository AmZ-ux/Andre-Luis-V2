import { cn } from '../../utils/cn'
import type { User } from '../../types/auth'
import { getRoleLabel } from '../../constants/permissions'

interface UserAvatarProps {
  user: User
  size?: 'sm' | 'md' | 'lg'
  showRole?: boolean
  showName?: boolean
  className?: string
}

export function UserAvatar({ user, size = 'md', showRole = false, showName = true, className }: UserAvatarProps) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center shrink-0',
          sizeClasses[size]
        )}
        aria-label={user.name}
      >
        {initials}
      </div>
      <div className="min-w-0">
        {showName && <p className="text-sm font-medium text-text truncate">{user.name}</p>}
        {showRole && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{getRoleLabel(user.role)}</p>
        )}
      </div>
    </div>
  )
}
