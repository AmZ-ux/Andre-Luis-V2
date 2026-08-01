import type { TransportType } from './passenger'

export type ReceiptStatus = 'awaiting' | 'approved' | 'rejected' | 'cancelled'

export type ReceiptHistoryAction =
  | 'created'
  | 'viewed'
  | 'approved'
  | 'rejected'
  | 'replaced'
  | 'cancelled_analysis'

export interface Receipt {
  id: string
  monthlyFeeId: string
  passengerId: string
  passengerName: string
  cpf: string
  transportType: TransportType
  institution?: string
  company?: string
  month: number
  year: number
  amount: number
  fileName: string
  fileType: string
  fileData: string
  fileSize: number
  status: ReceiptStatus
  reviewedBy?: string
  reviewDate?: string
  reviewNotes?: string
  createdAt: string
  updatedAt: string
}

export interface ReceiptHistoryEntry {
  id: string
  receiptId: string
  action: ReceiptHistoryAction
  performedBy: string
  performedById: string
  notes?: string
  createdAt: string
}

export interface ReceiptFilters {
  search: string
  status: ReceiptStatus | ''
  month: string
  year: string
  transportType: TransportType | ''
}

export interface ReceiptSort {
  field: 'passengerName' | 'createdAt' | 'amount' | 'status'
  direction: 'asc' | 'desc'
}

export interface ReceiptPagination {
  page: number
  pageSize: number
  total: number
}

export interface ReceiptSummary {
  awaiting: number
  approved: number
  rejected: number
  cancelled: number
  total: number
}

export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf']
export const MAX_FILE_SIZE = 5 * 1024 * 1024
