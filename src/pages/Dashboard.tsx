import { useState, useEffect } from 'react'
import { FinancialSummary } from '../components/dashboard/FinancialSummary'
import { StatisticCard } from '../components/dashboard/StatisticCard'
import { DashboardChart } from '../components/dashboard/DashboardChart'
import { UpcomingPayments } from '../components/dashboard/UpcomingPayments'
import { dashboardService } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboard'

export function Dashboard() {
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
        <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800 sm:divide-x">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[76px] bg-gray-100 dark:bg-gray-800 animate-[skeleton-pulse_1.5s_ease-in-out_infinite]" />
            ))}
          </div>
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
          className="h-11 px-5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-light transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <FinancialSummary data={data.financialSummary} />

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 divide-gray-100 dark:divide-gray-800 sm:divide-x">
          {data.statistics.map((stat, i) => (
            <StatisticCard key={stat.id} data={stat} index={i} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DashboardChart />
        </div>
        <UpcomingPayments payments={data.upcomingPayments} />
      </div>
    </div>
  )
}
