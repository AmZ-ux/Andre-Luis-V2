import { useState } from 'react'
import { useLocation, NavLink } from 'react-router-dom'
import { DynamicIcon } from '../ui/DynamicIcon'
import { cn } from '../../utils/cn'
import { NAV_ITEMS, PASSENGER_NAV_ITEMS, PROFILE_ITEM } from '../../constants/navigation'
import { useAuth } from '../../auth/AuthContext'
import { hasPermission } from '../../constants/permissions'
import type { Permission } from '../../constants/permissions'
import { BottomSheet } from '../ui/BottomSheet'

const itemPermissionMap: Record<string, Permission> = {
  '/': 'dashboard',
  '/passageiros': 'passengers',
  '/mensalidades': 'payments',
  '/comunicacao': 'communication',
  '/configuracoes': 'settings',
}

const MOBILE_PRIMARY_COUNT = 4

function isItemActive(pathname: string, itemPath: string) {
  return itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath)
}

export function MobileNav() {
  const location = useLocation()
  const { user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleItems =
    user?.role === 'passenger'
      ? PASSENGER_NAV_ITEMS
      : NAV_ITEMS.filter((item) => {
          if (!user) return false
          const permission = itemPermissionMap[item.path]
          return permission ? hasPermission(user.role, permission) : true
        })

  const primaryItems = visibleItems.slice(0, MOBILE_PRIMARY_COUNT)
  const moreItems =
    visibleItems.length > MOBILE_PRIMARY_COUNT
      ? [...visibleItems.slice(MOBILE_PRIMARY_COUNT), PROFILE_ITEM]
      : []

  const moreActive = moreItems.some((item) => isItemActive(location.pathname, item.path))

  const renderItem = (item: { label: string; path: string; icon: string }, onClick?: () => void) => {
    const isActive = isItemActive(location.pathname, item.path)
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        onClick={onClick}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px]',
          onClick && 'flex-row justify-start gap-3 w-full px-2 min-h-[48px] rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
        )}
      >
        <DynamicIcon
          name={item.icon}
          className={cn(
            'h-5 w-5 shrink-0 transition-colors',
            isActive ? 'text-primary' : 'text-gray-400'
          )}
        />
        <span
          className={cn(
            'text-[10px] font-medium transition-colors',
            onClick && 'text-sm',
            isActive ? 'text-primary' : 'text-gray-400'
          )}
        >
          {item.label}
        </span>
      </NavLink>
    )
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {primaryItems.map((item) => renderItem(item))}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px]"
            aria-label="Mais opções"
            aria-expanded={moreOpen}
          >
            <DynamicIcon
              name="MoreHorizontal"
              className={cn('h-5 w-5 transition-colors', moreActive ? 'text-primary' : 'text-gray-400')}
            />
            <span
              className={cn(
                'text-[10px] font-medium transition-colors',
                moreActive ? 'text-primary' : 'text-gray-400'
              )}
            >
              Mais
            </span>
          </button>
        )}
      </div>

      <BottomSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <div className="flex flex-col gap-1">
          {moreItems.map((item) => renderItem(item, () => setMoreOpen(false)))}
        </div>
      </BottomSheet>
    </nav>
  )
}
