import { NavLink } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { cn } from '../../utils/cn'
import { NAV_ITEMS, PASSENGER_NAV_ITEMS, PROFILE_ITEM } from '../../constants/navigation'
import { useAuth } from '../../auth/AuthContext'
import { hasPermission } from '../../constants/permissions'
import type { Permission } from '../../constants/permissions'

const itemPermissionMap: Record<string, Permission> = {
  '/': 'dashboard',
  '/passageiros': 'passengers',
  '/mensalidades': 'payments',
  '/comunicacao': 'communication',
  '/configuracoes': 'settings',
}

export function Sidebar() {
  const { user } = useAuth()

  const visibleItems =
    user?.role === 'passenger'
      ? PASSENGER_NAV_ITEMS
      : NAV_ITEMS.filter((item) => {
          if (!user) return false
          const permission = itemPermissionMap[item.path]
          return permission ? hasPermission(user.role, permission) : true
        })

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-40">
      <div className="flex items-center gap-3 px-6 h-18 border-b border-gray-100 dark:border-gray-800">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
          <Icons.Bus className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-text leading-tight">Transporte</p>
          <p className="text-xs text-primary font-medium">André Luis</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = Icons[item.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  'hover:bg-primary/5 hover:text-primary',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-500 dark:text-gray-400'
                )
              }
            >
              {Icon && <Icon className="h-5 w-5 shrink-0" />}
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <NavLink
          to={PROFILE_ITEM.path}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              'hover:bg-primary/5 hover:text-primary',
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-gray-500 dark:text-gray-400'
            )
          }
        >
          <Icons.UserCircle className="h-5 w-5 shrink-0" />
          <span>{PROFILE_ITEM.label}</span>
        </NavLink>
      </div>

      <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="bg-primary/5 rounded-xl p-4">
          <p className="text-xs font-semibold text-primary mb-1">Sistema v1.0</p>
          <p className="text-xs text-gray-400">Gerenciamento de Mensalidades</p>
        </div>
      </div>
    </aside>
  )
}
