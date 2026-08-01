import { useAuth } from '../../auth/AuthContext'
import { SearchBar } from './SearchBar'
import { PeriodSelector } from './PeriodSelector'
import { greeting } from '../../services/dashboardService'
import type { Period } from '../../types/dashboard'
import { Bell } from 'lucide-react'

interface DashboardHeaderProps {
  period: Period
  onPeriodChange: (period: Period) => void
}

export function DashboardHeader({ period, onPeriodChange }: DashboardHeaderProps) {
  const { user } = useAuth()
  const name = user?.name?.split(' ')[0] || 'Administrador'

  return (
    <div className="space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">
          {greeting()}, {name}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Aqui está o resumo do seu transporte
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SearchBar className="hidden sm:block w-56" />
        <PeriodSelector value={period} onChange={onPeriodChange} />
        <button
          className="relative h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4 text-text" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error" />
        </button>
      </div>
    </div>
  )
}
