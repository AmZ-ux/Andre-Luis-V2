import { storage } from './storage'
import { availabilityHistory } from './availabilityHistory'
import { availabilityRules } from './availabilityRules'
import { availabilityValidation } from './availabilityValidation'
import { config } from '../config'
import { realAvailability } from './realApi'
import type {
  Availability,
  AvailabilityFilters,
  AvailabilitySort,
  AvailabilityFormData,
} from '../types/availability'
import type { TransportType } from '../types/passenger'

const STORAGE_KEY = 'mock_availabilities'

function loadAvailabilities(): Availability[] {
  return storage.get<Availability[]>(STORAGE_KEY) || []
}

function saveAvailabilities(items: Availability[]): void {
  storage.set(STORAGE_KEY, items)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function toBRDate(dateStr: string): string {
  if (dateStr.includes('/')) return dateStr
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export const availabilityService = {
  async list(
    filters: AvailabilityFilters,
    sort: AvailabilitySort,
    page: number,
    pageSize: number
  ): Promise<{ data: Availability[]; total: number }> {
    if (config.realApi) {
      const sortFieldMap: Record<string, string> = {
        passengerName: 'passenger_name',
        startDate: 'start_date',
        endDate: 'end_date',
        createdAt: 'created_at',
      }
      return realAvailability.list({
        search: filters.search || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        transportType: filters.transportType || undefined,
        sortField: sortFieldMap[sort.field] || 'start_date',
        sortDirection: sort.direction,
        page,
        pageSize,
      })
    }
    await delay(300)
    let data = loadAvailabilities()

    data = data.map((a) => ({
      ...a,
      status: availabilityRules.getStatus(a) as Availability['status'],
    }))

    if (filters.search) {
      const q = filters.search.toLowerCase()
      data = data.filter(
        (a) =>
          a.passengerName.toLowerCase().includes(q) ||
          a.cpf.includes(q) ||
          a.institution?.toLowerCase().includes(q) ||
          a.company?.toLowerCase().includes(q)
      )
    }

    if (filters.type) data = data.filter((a) => a.type === filters.type)
    if (filters.status) data = data.filter((a) => a.status === filters.status)
    if (filters.transportType) data = data.filter((a) => a.transportType === filters.transportType)
    if (filters.city) {
      data = data.filter((a) => a.city?.toLowerCase().includes(filters.city.toLowerCase()))
    }
    if (filters.periodStart) {
      data = data.filter((a) => a.startDate >= toBRDate(filters.periodStart))
    }
    if (filters.periodEnd) {
      data = data.filter((a) => a.endDate <= toBRDate(filters.periodEnd))
    }

    data.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'passengerName':
          return a.passengerName.localeCompare(b.passengerName) * dir
        case 'startDate':
          return a.startDate.localeCompare(b.startDate) * dir
        case 'endDate':
          return a.endDate.localeCompare(b.endDate) * dir
        case 'createdAt':
          return a.createdAt.localeCompare(b.createdAt) * dir
        default:
          return 0
      }
    })

    const total = data.length
    const start = (page - 1) * pageSize
    const paged = data.slice(start, start + pageSize)

    return { data: paged, total }
  },

  async getById(id: string): Promise<Availability | null> {
    if (config.realApi) {
      const res = await realAvailability.getById(id)
      return res.availability
    }
    await delay(200)
    const data = loadAvailabilities()
    const item = data.find((a) => a.id === id) || null
    if (item) {
      item.status = availabilityRules.getStatus(item) as Availability['status']
    }
    return item
  },

  async getByPassengerId(passengerId: string): Promise<Availability[]> {
    if (config.realApi) return realAvailability.my()
    const data = loadAvailabilities()
    return data
      .filter((a) => a.passengerId === passengerId)
      .map((a) => ({
        ...a,
        status: availabilityRules.getStatus(a) as Availability['status'],
      }))
  },

  async getAllActive(): Promise<Availability[]> {
    if (config.realApi) return realAvailability.active()
    const data = loadAvailabilities()
    return data
      .map((a) => ({
        ...a,
        status: availabilityRules.getStatus(a) as Availability['status'],
      }))
      .filter((a) => a.status === 'active' || a.status === 'scheduled')
  },

  async create(
    data: AvailabilityFormData & {
      passengerId: string
      passengerName: string
      cpf: string
      transportType: TransportType
      institution?: string
      company?: string
      city?: string
      submittedBy: string
      submittedById: string
    }
  ): Promise<Availability> {
    if (config.realApi) {
      return realAvailability.create(data)
    }
    await delay(400)

    const dateValidation = availabilityValidation.validateDates(data.startDate, data.endDate)
    if (!dateValidation.valid) throw new Error(dateValidation.error)

    const reasonValidation = availabilityValidation.validateReason(data.reason)
    if (!reasonValidation.valid) throw new Error(reasonValidation.error)

    const existing = loadAvailabilities().filter(
      (a) => a.passengerId === data.passengerId && a.status !== 'cancelled' && a.status !== 'finished'
    )
    const overlapValidation = availabilityValidation.validateNoOverlap(
      data.startDate,
      data.endDate,
      existing
    )
    if (!overlapValidation.valid) throw new Error(overlapValidation.error)

    const startBR = toBRDate(data.startDate)
    const endBR = toBRDate(data.endDate)

    const availability: Availability = {
      id: `av-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      passengerId: data.passengerId,
      passengerName: data.passengerName,
      cpf: data.cpf,
      transportType: data.transportType,
      institution: data.institution,
      company: data.company,
      city: data.city,
      type: data.type,
      startDate: startBR,
      endDate: endBR,
      reason: data.reason,
      notes: data.notes,
      status: 'scheduled',
      createdAt: new Date().toLocaleString('pt-BR'),
      updatedAt: new Date().toLocaleString('pt-BR'),
    }

    const items = loadAvailabilities()
    items.unshift(availability)
    saveAvailabilities(items)

    await availabilityHistory.add(availability.id, 'created', data.submittedBy, data.submittedById)

    return availability
  },

  async cancel(
    id: string,
    reason: string,
    cancelledBy: string,
    cancelledById: string
  ): Promise<Availability> {
    if (config.realApi) {
      return realAvailability.cancel(id, reason)
    }
    await delay(300)
    const items = loadAvailabilities()
    const idx = items.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Período não encontrado')

    const current = items[idx]
    if (!availabilityRules.canCancel(current)) throw new Error('Não é possível cancelar este período')

    items[idx] = {
      ...current,
      status: 'cancelled',
      cancelledAt: new Date().toLocaleString('pt-BR'),
      cancellationReason: reason,
      updatedAt: new Date().toLocaleString('pt-BR'),
    }
    saveAvailabilities(items)

    await availabilityHistory.add(id, 'cancelled', cancelledBy, cancelledById, reason)

    return items[idx]
  },
}
