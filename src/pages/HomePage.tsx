import { useSearchParams } from 'react-router-dom'
import { LayoutDashboard, BarChart3 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { PageTabs } from '../components/ui/PageTabs'
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
      <div className="flex items-center justify-between gap-3">
        <PageTabs tabs={adminTabs} value={tab} onChange={handleTabChange} />
        <NotificationBell className="shrink-0" />
      </div>

      {tab === 'relatorios' ? <Relatorios embedded /> : <Dashboard />}
    </div>
  )
}
