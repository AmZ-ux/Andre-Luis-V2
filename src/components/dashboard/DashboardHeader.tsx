import { useAuth } from '../../auth/AuthContext'
import { SearchBar } from './SearchBar'
import { PeriodSelector } from './PeriodSelector'
import { greeting } from '../../services/dashboardService'
import type { Period } from '../../types/dashboard'

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
      </div>
    </div>
  )
}
