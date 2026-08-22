import { useSearchParams } from 'react-router-dom'
import { LayoutDashboard, BarChart3 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PageTabs } from '../components/ui/PageTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { NotificationBell } from '../components/layout/NotificationBell'
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
      <PageHeader
        className="hidden sm:block"
        eyebrow="Operação"
        title="Início"
        subtitle={tab === 'relatorios' ? 'Análise de dados e métricas' : 'Visão geral do sistema'}
        actions={<NotificationBell className="shrink-0" />}
      />

      <PageTabs tabs={adminTabs} value={tab} onChange={handleTabChange} />

      {tab === 'relatorios' ? <Relatorios embedded /> : <Dashboard />}
    </div>
  )
}
