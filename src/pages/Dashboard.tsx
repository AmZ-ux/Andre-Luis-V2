import { useState, useEffect } from 'react'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { FinancialSummary } from '../components/dashboard/FinancialSummary'
import { StatisticCard } from '../components/dashboard/StatisticCard'
import { DashboardChart } from '../components/dashboard/DashboardChart'
import { RecentActivity } from '../components/dashboard/RecentActivity'
import { UpcomingPayments } from '../components/dashboard/UpcomingPayments'
import { NotificationsPanel } from '../components/dashboard/NotificationsPanel'
import { QuickActions } from '../components/dashboard/QuickActions'
import { dashboardService } from '../services/dashboardService'
import type { Period, DashboardData } from '../types/dashboard'

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    dashboardService
      .load()
      .then(setData)
      .catch(() => setError('Erro ao carregar dados do dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="h-8 w-72 bg-gray-200 dark:bg-gray-700 rounded-lg animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
        </div>
        <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
          ))}
        </div>
      </div>
    )
  }

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    dashboardService
      .load()
      .then(setData)
      .catch(() => setError('Erro ao carregar dados do dashboard'))
      .finally(() => setLoading(false))
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="h-16 w-16 rounded-lg bg-error-soft flex items-center justify-center mb-4">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-text mb-1">Erro ao carregar</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'Dados indisponíveis'}</p>
        <button
          onClick={handleRetry}
          className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader period={period} onPeriodChange={setPeriod} />

      <FinancialSummary data={data.financialSummary} />

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800 sm:divide-x">
          {data.statistics.map((stat, i) => (
            <StatisticCard key={stat.id} data={stat} index={i} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DashboardChart />
          <RecentActivity activities={data.recentActivities} />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <UpcomingPayments payments={data.upcomingPayments} />
          <NotificationsPanel notifications={data.notifications} />
        </div>
      </div>
    </div>
  )
}
