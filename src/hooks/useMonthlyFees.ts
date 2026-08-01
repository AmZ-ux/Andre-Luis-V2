import { useState, useEffect, useCallback } from 'react'
import type {
  MonthlyFee,
  MonthlyFeeFilters,
  MonthlyFeeSort,
  MonthlyFeePagination,
} from '../types/monthlyFee'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { paymentService } from '../services/paymentService'

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

  const registerPayment = useCallback(
    async (
      feeId: string,
      data: { amount: number; paymentDate: string; paymentMethod: 'pix' | 'cash' | 'transfer' | 'card'; notes?: string }
    ) => {
      const result = await paymentService.register(feeId, data)
      setFees((prev) =>
        prev.map((f) =>
          f.id === feeId
            ? { ...f, status: result.feeStatus, payment: result.payment }
            : f
        )
      )
      return result
    },
    []
  )

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

  const generateFees = useCallback(async (month: number, year: number) => {
    const created = await monthlyFeeService.generateMissing(month, year)
    await load()
    return created
  }, [load])

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    fees,
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
    registerPayment,
    cancelFee,
    exemptFee,
    updateFee,
    generateFees,
    reload: load,
  }
}
