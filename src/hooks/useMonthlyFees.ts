import { useState, useEffect, useCallback } from 'react'
import type {
  MonthlyFee,
  MonthlyFeeFilters,
  MonthlyFeeSort,
  MonthlyFeePagination,
  MonthlyFeeSummary,
} from '../types/monthlyFee'
import { monthlyFeeService } from '../services/monthlyFeeService'

const defaultFilters: MonthlyFeeFilters = {
  search: '',
  month: '',
  year: '',
  status: '',
  transportType: '',
  city: '',
  passenger: '',
  dueDayStart: '',
  dueDayEnd: '',
}

const defaultSort: MonthlyFeeSort = { field: 'dueDay', direction: 'asc' }

export function useMonthlyFees(pageSize = 15) {
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [summary, setSummary] = useState<MonthlyFeeSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<MonthlyFeeFilters>(defaultFilters)
  const [sort, setSort] = useState<MonthlyFeeSort>(defaultSort)
  const [pagination, setPagination] = useState<MonthlyFeePagination>({
    page: 1,
    pageSize,
    total: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await monthlyFeeService.list(
        filters,
        sort,
        pagination.page,
        pagination.pageSize
      )
      setFees(result.data)
      setSummary(result.summary ?? null)
      setPagination((prev) => ({ ...prev, total: result.total }))
    } catch {
      setError('Erro ao carregar mensalidades')
    } finally {
      setLoading(false)
    }
  }, [filters, sort, pagination.page, pagination.pageSize])

  useEffect(() => {
    load()
  }, [load])

  const updateFilters = useCallback((updates: Partial<MonthlyFeeFilters>) => {
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

  const setSortField = useCallback((field: MonthlyFeeSort['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const cancelFee = useCallback(async (id: string, reason: string) => {
    await monthlyFeeService.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
    })
    setFees((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'cancelled', cancellationReason: reason } : f
      )
    )
  }, [])

  const exemptFee = useCallback(async (id: string, reason: string) => {
    await monthlyFeeService.update(id, {
      status: 'exempt',
      exemptionReason: reason,
    })
    setFees((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'exempt', exemptionReason: reason } : f
      )
    )
  }, [])

  const updateFee = useCallback(
    async (id: string, data: { amount: string; dueDay: string; notes: string }) => {
      const updates: Partial<MonthlyFee> = {
        amount: parseFloat(data.amount.replace(',', '.')),
        dueDay: parseInt(data.dueDay),
        notes: data.notes,
      }
      await monthlyFeeService.update(id, updates)
      setFees((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        )
      )
    },
    []
  )

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    fees,
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
    cancelFee,
    exemptFee,
    updateFee,
    reload: load,
  }
}
