import { useState, useEffect, useCallback } from 'react'
import type { Passenger, PassengerFilters, SortState, PaginationState } from '../types/passenger'
import { passengerService } from '../services/passengerService'

const defaultFilters: PassengerFilters = {
  search: '',
  status: '',
  transportType: '',
  city: '',
  institution: '',
  dueDay: '',
  company: '',
}

const defaultSort: SortState = { field: 'name', direction: 'asc' }

export function usePassengers(pageSize = 12) {
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<PassengerFilters>(defaultFilters)
  const [sort, setSort] = useState<SortState>(defaultSort)
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize, total: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await passengerService.list(filters, sort, pagination.page, pagination.pageSize)
      setPassengers(result.data)
      setPagination((prev) => ({ ...prev, total: result.total }))
    } catch {
      setError('Erro ao carregar passageiros')
    } finally {
      setLoading(false)
    }
  }, [filters, sort, pagination.page, pagination.pageSize])

  useEffect(() => {
    load()
  }, [load])

  const updateFilters = useCallback((updates: Partial<PassengerFilters>) => {
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

  const setSortField = useCallback((field: SortState['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const removePassenger = useCallback(async (id: string) => {
    await passengerService.remove(id)
    setPassengers((prev) => prev.filter((p) => p.id !== id))
    setPagination((prev) => ({ ...prev, total: prev.total - 1 }))
  }, [])

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    passengers,
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
    removePassenger,
    reload: load,
  }
}
