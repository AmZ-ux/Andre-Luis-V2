import { availabilityRules } from './availabilityRules'
import type { Availability, AvailabilitySummary } from '../types/availability'

export const availabilityCalculator = {
  computeSummary(availabilities: Availability[]): AvailabilitySummary {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

    return {
      onVacation: availabilities.filter((a) => availabilityRules.getStatus(a) === 'active').length,
      returningToday: availabilities.filter(
        (a) => a.endDate === todayStr && availabilityRules.getStatus(a) === 'active'
      ).length,
      startingToday: availabilities.filter(
        (a) => a.startDate === todayStr && a.status !== 'cancelled'
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
