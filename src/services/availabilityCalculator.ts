import { availabilityRules } from './availabilityRules'
import type { Availability, AvailabilitySummary } from '../types/availability'

function parseDate(dateStr: string): Date {
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const [d, m, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d)
}

export const availabilityCalculator = {
  computeSummary(availabilities: Availability[]): AvailabilitySummary {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      onVacation: availabilities.filter((a) => availabilityRules.getStatus(a) === 'active').length,
      returningToday: availabilities.filter(
        (a) =>
          availabilityRules.getStatus(a) === 'active' &&
          parseDate(a.endDate).getTime() === today.getTime()
      ).length,
      startingToday: availabilities.filter(
        (a) => a.status !== 'cancelled' && parseDate(a.startDate).getTime() === today.getTime()
      ).length,
      future: availabilities.filter(
        (a) => availabilityRules.getStatus(a) === 'scheduled'
      ).length,
      total: availabilities.length,
    }
  },

  isOnVacationInMonth(
    passengerId: string,
    month: number,
    year: number,
    availabilities: Availability[]
  ): boolean {
    const passengerAvs = availabilities.filter(
      (a) => a.passengerId === passengerId && a.status !== 'cancelled'
    )

    return passengerAvs.some((av) => {
      const activeStatus = availabilityRules.getStatus(av)
      if (activeStatus === 'cancelled') return false
      return availabilityRules.isMonthContained(month, year, av.startDate, av.endDate)
    })
  },
}
