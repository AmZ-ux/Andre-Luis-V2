import type { AvailabilityReportData } from '../types/reports'
import type { Availability } from '../types/availability'

function loadAvailabilities(): Availability[] {
  const stored = localStorage.getItem('mock_availabilities')
  return stored ? JSON.parse(stored) : []
}

export const availabilityAnalytics = {
  async getReportData(): Promise<AvailabilityReportData> {
    const items = loadAvailabilities()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

    const active = items.filter((a) => a.status !== 'cancelled' && a.startDate <= todayStr && a.endDate >= todayStr).length
    const scheduled = items.filter((a) => a.status !== 'cancelled' && a.startDate > todayStr).length
    const finished = items.filter((a) => a.status === 'finished' || (a.status !== 'cancelled' && a.endDate < todayStr)).length
    const cancelled = items.filter((a) => a.status === 'cancelled').length
    const returningToday = items.filter((a) => a.endDate === todayStr && a.status !== 'cancelled').length

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthMap = new Map<string, number>()
    items.filter((a) => a.status !== 'cancelled').forEach((a) => {
      const month = parseInt(a.startDate.split('/')[1])
      const key = monthNames[month - 1]
      monthMap.set(key, (monthMap.get(key) || 0) + 1)
    })
    const byMonth = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

    return {
      active, scheduled, finished, cancelled,
      total: items.length,
      returningToday,
      byMonth,
    }
  },
}
