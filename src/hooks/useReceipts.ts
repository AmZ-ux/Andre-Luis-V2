import { useState, useEffect, useCallback } from 'react'
import type {
  Receipt,
  ReceiptFilters,
  ReceiptSort,
  ReceiptPagination,
  ReceiptSummary,
} from '../types/receipt'
import { receiptService } from '../services/receiptService'
import { receiptApproval } from '../services/receiptApproval'

const defaultFilters: ReceiptFilters = {
  search: '',
  status: '',
  month: '',
  year: '',
  transportType: '',
}

const defaultSort: ReceiptSort = { field: 'createdAt', direction: 'desc' }

export function useReceipts(pageSize = 15) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [summary, setSummary] = useState<ReceiptSummary>({
    awaiting: 0, approved: 0, rejected: 0, cancelled: 0, total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReceiptFilters>(defaultFilters)
  const [sort, setSort] = useState<ReceiptSort>(defaultSort)
  const [pagination, setPagination] = useState<ReceiptPagination>({
    page: 1,
    pageSize,
    total: 0,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [result, summaryData] = await Promise.all([
        receiptService.list(filters, sort, pagination.page, pagination.pageSize),
        receiptService.getSummary(),
      ])
      setReceipts(result.data)
      setPagination((prev) => ({ ...prev, total: result.total }))
      setSummary(summaryData)
    } catch {
      setError('Erro ao carregar comprovantes')
    } finally {
      setLoading(false)
    }
  }, [filters, sort, pagination.page, pagination.pageSize])

  useEffect(() => {
    load()
  }, [load])

  const updateFilters = useCallback((updates: Partial<ReceiptFilters>) => {
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

  const setSortField = useCallback((field: ReceiptSort['field']) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [])

  const approveReceipt = useCallback(
    async (receiptId: string, adminName: string, adminId: string, notes?: string) => {
      const updated = await receiptApproval.approve(receiptId, adminName, adminId, notes)
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? updated : r)))
      setSummary((prev) => ({
        ...prev,
        awaiting: prev.awaiting - 1,
        approved: prev.approved + 1,
      }))
      return updated
    },
    []
  )

  const rejectReceipt = useCallback(
    async (receiptId: string, adminName: string, adminId: string, reason: string) => {
      const updated = await receiptApproval.reject(receiptId, adminName, adminId, reason)
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? updated : r)))
      setSummary((prev) => ({
        ...prev,
        awaiting: prev.awaiting - 1,
        rejected: prev.rejected + 1,
      }))
      return updated
    },
    []
  )

  const cancelReview = useCallback(
    async (receiptId: string, adminName: string, adminId: string, reason?: string) => {
      const updated = await receiptApproval.cancelReview(receiptId, adminName, adminId, reason)
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? updated : r)))
      setSummary((prev) => ({
        ...prev,
        awaiting: prev.awaiting - 1,
        cancelled: prev.cancelled + 1,
      }))
      return updated
    },
    []
  )

  const markViewed = useCallback(
    async (receiptId: string, adminName: string, adminId: string) => {
      await receiptApproval.markViewed(receiptId, adminName, adminId)
    },
    []
  )

  const uploadReceipt = useCallback(
    async (data: Parameters<typeof receiptService.create>[0]) => {
      const created = await receiptService.create(data)
      setReceipts((prev) => [created, ...prev])
      setSummary((prev) => ({
        ...prev,
        awaiting: prev.awaiting + 1,
        total: prev.total + 1,
      }))
      return created
    },
    []
  )

  const replaceReceipt = useCallback(
    async (
      receiptId: string,
      file: { fileName: string; fileType: string; fileData: string; fileSize: number },
      submittedBy: string,
      submittedById: string
    ) => {
      const updated = await receiptService.replace(receiptId, file, submittedBy, submittedById)
      setReceipts((prev) => prev.map((r) => (r.id === receiptId ? updated : r)))
      return updated
    },
    []
  )

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    receipts,
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
    approveReceipt,
    rejectReceipt,
    cancelReview,
    markViewed,
    uploadReceipt,
    replaceReceipt,
    reload: load,
  }
}
