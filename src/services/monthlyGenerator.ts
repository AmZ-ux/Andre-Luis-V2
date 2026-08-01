import { passengerService } from './passengerService'
import { monthlyFeeService } from './monthlyFeeService'
import { availabilityService } from './availabilityService'
import { availabilityCalculator } from './availabilityCalculator'
import type { MonthlyFee } from '../types/monthlyFee'

export interface GenerationRequest {
  month: number
  year: number
  passengerIds?: string[]
}

export const monthlyGenerator = {
  async generate(request: GenerationRequest): Promise<MonthlyFee[]> {
    const { month, year, passengerIds } = request
    const allPassengers = await passengerService.list(
      { search: '', status: '', transportType: '', city: '', institution: '', dueDay: '', company: '' },
      { field: 'name', direction: 'asc' },
      1,
      1000
    )

    let candidates = allPassengers.data
    if (passengerIds && passengerIds.length > 0) {
      candidates = candidates.filter((p) => passengerIds.includes(p.id))
    }

    const created: MonthlyFee[] = []
    const allAvailabilities = await availabilityService.getAllActive()

    for (const passenger of candidates) {
      const exists = await monthlyFeeService.exists(passenger.id, month, year)
      if (exists) continue

      if (passenger.status === 'vacation') {
        const vacationMonths = [1, 7, 12]
        if (vacationMonths.includes(month)) continue
      }

      if (passenger.status === 'inactive' || passenger.status === 'blocked') continue

      const onVacation = availabilityCalculator.isOnVacationInMonth(
        passenger.id,
        month,
        year,
        allAvailabilities
      )
      if (onVacation) continue

      const fee = await monthlyFeeService.create({
        passengerId: passenger.id,
        passengerName: passenger.name,
        cpf: passenger.cpf,
        transportType: passenger.transportType,
        institution: passenger.institution,
        company: passenger.company,
        month,
        year,
        amount: passenger.monthlyFee,
        dueDay: passenger.dueDay,
      })

      created.push(fee)
    }

    return created
  },

  async generateForPeriod(
    startMonth: number,
    startYear: number,
    endMonth: number,
    endYear: number
  ): Promise<MonthlyFee[]> {
    const all: MonthlyFee[] = []
    let m = startMonth
    let y = startYear

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const result = await this.generate({ month: m, year: y })
      all.push(...result)
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }

    return all
  },
}
