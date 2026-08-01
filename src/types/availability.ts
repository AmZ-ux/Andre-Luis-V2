import type { TransportType } from './passenger'

export type AvailabilityType = 'vacation'

export const AVAILABILITY_TYPES: { value: AvailabilityType; label: string }[] = [
  { value: 'vacation', label: 'Férias' },
]

export type AvailabilityStatus = 'scheduled' | 'active' | 'finished' | 'cancelled'

export type AvailabilityHistoryAction = 'created' | 'updated' | 'cancelled' | 'finished'

export interface Availability {
  id: string
  passengerId: string
  passengerName: string
  cpf: string
  transportType: TransportType
  institution?: string
  company?: string
  city?: string
  type: AvailabilityType
  startDate: string
  endDate: string
  reason: string
  notes?: string
  status: AvailabilityStatus
  cancelledAt?: string
  cancellationReason?: string
  createdAt: string
  updatedAt: string
}

export interface AvailabilityHistoryEntry {
  id: string
  availabilityId: string
  action: AvailabilityHistoryAction
  performedBy: string
  performedById: string
  notes?: string
  createdAt: string
}

export interface AvailabilityFilters {
  search: string
  type: AvailabilityType | ''
  status: AvailabilityStatus | ''
  transportType: TransportType | ''
  city: string
  periodStart: string
  periodEnd: string
}

export interface AvailabilitySort {
  field: 'passengerName' | 'startDate' | 'endDate' | 'createdAt'
  direction: 'asc' | 'desc'
}

export interface AvailabilityPagination {
  page: number
  pageSize: number
  total: number
}

export interface AvailabilitySummary {
  onVacation: number
  returningToday: number
  startingToday: number
  future: number
  total: number
}

export interface AvailabilityFormData {
  type: AvailabilityType
  startDate: string
  endDate: string
  reason: string
  notes: string
}

export const OVERLAP_CONFIG = {
  allowPastDates: false,
  minDaysBeforeStart: 1,
}
