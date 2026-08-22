import { NavLink } from 'react-router-dom'
import { DynamicIcon } from '../ui/DynamicIcon'
import { cn } from '../../utils/cn'
import { NAV_ITEMS, PASSENGER_NAV_ITEMS, PROFILE_ITEM } from '../../constants/navigation'
import { useAuth } from '../../auth/AuthContext'
import { hasPermission } from '../../constants/permissions'
import type { Permission } from '../../constants/permissions'
import type { NavItem } from '../../types'

const itemPermissionMap: Record<string, Permission> = {
  '/': 'dashboard',
  '/passageiros': 'passengers',
  '/mensalidades': 'payments',
  '/comunicacao': 'communication',
  '/configuracoes': 'settings',
}

function groupLabel(path: string): string {
  if (path === '/' || path === '/mensalidades' || path === '/passageiros' || path === '/minhas-mensalidades') {
    return 'Operação'
  }
  return 'Sistema'
}

export function Sidebar() {
  const { user } = useAuth()

  const visibleItems: NavItem[] =
    user?.role === 'passenger'
      ? PASSENGER_NAV_ITEMS
      : NAV_ITEMS.filter((item) => {
          if (!user) return false
          const permission = itemPermissionMap[item.path]
          return permission ? hasPermission(user.role, permission) : true
        })

  const itemsWithProfile = user?.role === 'passenger' ? visibleItems : [...visibleItems, PROFILE_ITEM]
  const groups = itemsWithProfile.reduce<{ label: string; items: NavItem[] }[]>((acc, item) => {
    const label = groupLabel(item.path)
    const group = acc.find((g) => g.label === label)
    if (group) group.items.push(item)
    else acc.push({ label, items: [item] })
    return acc
  }, [])

  const initials = (user?.name ?? 'AD')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-150',
      'text-gray-400 hover:text-white hover:bg-white/5',
      isActive && 'text-white bg-primary/30'
    )

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-navy dark:bg-gray-950 z-40">
      <div className="flex items-center gap-3 px-6 h-18 border-b border-white/10 shrink-0">
        <div className="h-10 w-10 rounded-[14px] bg-primary flex items-center justify-center shrink-0 text-white font-bold">
          T
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight tracking-tight">Transportes</p>
          <p className="text-xs text-primary-soft font-semibold uppercase tracking-wide">André Luis</p>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 overflow-y-auto" aria-label="Menu principal">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.path === '/'} className={linkClass}>
                  <DynamicIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4 shrink-0">
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5 border border-white/10">
          <div className="h-8 w-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
              {user?.role === 'passenger' ? 'Passageiro' : 'Administrador'}
            </p>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-500 mt-3">v1.0 · Sistema de mensalidades</p>
      </div>
    </aside>
  )
}