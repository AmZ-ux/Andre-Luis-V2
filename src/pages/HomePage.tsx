import { useSearchParams } from 'react-router-dom'
import { LayoutDashboard, BarChart3 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PageTabs } from '../components/ui/PageTabs'
import { Dashboard } from './Dashboard'
import { PassengerDashboard } from './PassengerDashboard'
import { Relatorios } from './Relatorios'

const adminTabs = [
  { key: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'relatorios', label: 'Relatórios', icon: BarChart3 },
]

export function HomePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  if (user?.role === 'passenger') {
    return <PassengerDashboard />
  }

  const tab = searchParams.get('tab') === 'relatorios' ? 'relatorios' : 'visao-geral'

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'visao-geral' ? {} : { tab: key }, { replace: true })
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">Início</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tab === 'relatorios' ? 'Análise de dados e métricas' : 'Visão geral do sistema'}
        </p>
      </div>

      <PageTabs tabs={adminTabs} value={tab} onChange={handleTabChange} />

      {tab === 'relatorios' ? <Relatorios embedded /> : <Dashboard />}
    </div>
  )
}
