import { useAuth } from '../../auth/AuthContext'
import { SearchBar } from './SearchBar'
import { PeriodSelector } from './PeriodSelector'
import { PageHeader } from '../ui/PageHeader'
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
    <PageHeader
      eyebrow="Painel administrativo"
      title={`${greeting()}, ${name}!`}
      subtitle="Resumo de operações e resultados do transporte"
      actions={
        <>
          <SearchBar className="hidden sm:block w-56" />
          <PeriodSelector value={period} onChange={onPeriodChange} />
        </>
      }
    />
  )
}