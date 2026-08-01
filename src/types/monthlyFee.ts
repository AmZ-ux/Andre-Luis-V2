import type { TransportType, PaymentMethod } from './passenger'

export type MonthlyFeeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'exempt'

export interface Payment {
  id: string
  monthlyFeeId: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: string
}

export interface MonthlyFee {
  id: string
  passengerId: string
  passengerName: string
  cpf: string
  transportType: TransportType
  institution?: string
  company?: string
  month: number
  year: number
  amount: number
  dueDay: number
  dueDate: string
  status: MonthlyFeeStatus
  payment?: Payment
  notes?: string
  cancellationReason?: string
  exemptionReason?: string
  createdAt: string
  updatedAt: string
}

export interface MonthlyFeeFilters {
  search: string
  month: string
  year: string
  status: MonthlyFeeStatus | ''
  transportType: TransportType | ''
  city: string
  passenger: string
  dueDayStart: string
  dueDayEnd: string
}

export interface MonthlyFeeSort {
  field: 'passengerName' | 'amount' | 'dueDay' | 'paymentDate' | 'createdAt'
  direction: 'asc' | 'desc'
}

export interface MonthlyFeePagination {
  page: number
  pageSize: number
  total: number
}

export interface PaymentFormData {
  amount: string
  paymentDate: string
  paymentMethod: PaymentMethod
  notes: string
}

export interface MonthlyFeeEditData {
  amount: string
  dueDay: string
  notes: string
}
