import { useState, useEffect, useCallback } from 'react'
import type {
  Availability,
  AvailabilityFilters,
  AvailabilitySort,
  AvailabilityPagination,
  AvailabilitySummary,
  AvailabilityFormData,
} from '../types/availability'
import { availabilityService } from '../services/availabilityService'
import { availabilityCalculator } from '../services/availabilityCalculator'
import { config } from '../config'
import { realAvailability } from '../services/realApi'

const defaultFilters: AvailabilityFilters = {
  search: '',
  type: '',
  status: '',
  transportType: '',
  city: '',
  periodStart: '',
  periodEnd: '',
}

const defaultSort: AvailabilitySort = { field: 'startDate', direction: 'desc' }

export function useAvailability(pageSize = 15) {
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [summary, setSummary] = useState<AvailabilitySummary>({
    onVacation: 0, returningToday: 0, startingToday: 0, future: 0, total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AvailabilityFilters>(defaultFilters)
  const [sort, setSort] = useState<AvailabilitySort>(defaultSort)
  const [pagination, setPagination] = useState<AvailabilityPagination>({
    page: 1,
    pageSize,
    total: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await availabilityService.list(filters, sort, pagination.page, pagination.pageSize)
      setAvailabilities(result.data)
      setPagination((prev) => ({ ...prev, total: result.total }))
      setSummary(availabilityCalculator.computeSummary(result.data))
    } catch {
      setError('Erro ao carregar períodos')
    } finally {
      setLoading(false)
    }
  }, [filters, sort, pagination.page, pagination.pageSize])

  const loadAllWithSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (config.realApi) {
        setSummary(await realAvailability.summary())
        return
      }
      const allFilters = { ...defaultFilters }
      const all = await availabilityService.list(allFilters, { field: 'createdAt', direction: 'desc' }, 1, 9999)
      setSummary(availabilityCalculator.computeSummary(all.data))
    } catch {
      // summary supplement failure is non-critical
    }
  }, [])

  useEffect(() => {
    load()
    loadAllWithSummary()
  }, [load, loadAllWithSummary])

  const updateFilters = useCallback((updates: Partial<AvailabilityFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }, [])

  const setSortField = useCallback((field: AvailabilitySort['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const createAvailability = useCallback(
    async (data: AvailabilityFormData & {
      passengerId: string
      passengerName: string
      cpf: string
      transportType: import('../types/passenger').TransportType
      institution?: string
      company?: string
      city?: string
      submittedBy: string
      submittedById: string
    }) => {
      const created = await availabilityService.create(data)
      setAvailabilities((prev) => [created, ...prev])
      await loadAllWithSummary()
      return created
    },
    [loadAllWithSummary]
  )

  const cancelAvailability = useCallback(
    async (id: string, reason: string, cancelledBy: string, cancelledById: string) => {
      const updated = await availabilityService.cancel(id, reason, cancelledBy, cancelledById)
      setAvailabilities((prev) => prev.map((a) => (a.id === id ? updated : a)))
      await loadAllWithSummary()
      return updated
    },
    [loadAllWithSummary]
  )

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    availabilities,
    summary,
    loading,
    error,
    filters,
    sort,
    pagination,
    totalPages,
    updateFilters,
    resetFilters,
    setPage,
    setSortField,
    createAvailability,
    cancelAvailability,
    reload: load,
  }
}
