// Real API methods that call the Express backend
// Import and use these instead of mock services when VITE_REAL_API=true

import { api } from './apiClient'
import type { LoginCredentials, AuthResponse, User, RegisterCredentials } from '../types/auth'
import type { Passenger, PassengerFilters, SortState } from '../types/passenger'
import type { MonthlyFee, MonthlyFeeFilters, MonthlyFeeSort, Payment } from '../types/monthlyFee'
import type { Receipt, ReceiptFilters } from '../types/receipt'
import type { Availability } from '../types/availability'
import type { DashboardData } from '../types/dashboard'

// --- Auth ---
export const realAuth = {
  login: (creds: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', creds, true),

  register: (data: RegisterCredentials) =>
    api.post<AuthResponse>('/auth/register', data, true),

  me: () =>
    api.get<User>('/auth/me'),

  updateProfile: (data: Partial<User>) =>
    api.put<User>('/auth/profile', data),

  sendVerificationEmail: () =>
    api.post<{ success: boolean; demoCode?: string; alreadyVerified?: boolean }>('/auth/verify-email/send'),

  confirmVerificationEmail: (code: string) =>
    api.post<{ success: boolean }>('/auth/verify-email/confirm', { code }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ success: boolean }>('/auth/change-password', data),

  refresh: () =>
    api.post<{ token: string; expiresAt: number }>('/auth/refresh'),

  logout: () =>
    api.post<{ success: boolean }>('/auth/logout'),

  forgotPassword: (email: string) =>
    api.post<{ token: string; message: string }>('/auth/forgot-password', { email }, true),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }, true),
}

// --- Passengers ---
export const realPassengers = {
  list: (filters: PassengerFilters, sort: SortState, page: number, pageSize: number) =>
    api.get<{ data: Passenger[]; total: number }>('/passengers', { ...filters, sortField: sort.field, sortDirection: sort.direction, page, pageSize }),

  getById: (id: string) =>
    api.get<Passenger>(`/passengers/${id}`),

  create: (data: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Passenger>('/passengers', data),

  update: (id: string, data: Partial<Passenger>) =>
    api.put<Passenger>(`/passengers/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/passengers/${id}`),
}

// --- Monthly Fees ---
export const realMonthlyFees = {
  list: (filters: MonthlyFeeFilters, sort: MonthlyFeeSort, page: number, pageSize: number) =>
    api.get<{ data: MonthlyFee[]; total: number }>('/monthly-fees', { ...filters, sortField: sort.field, sortDirection: sort.direction, page, pageSize }),

  getById: (id: string) =>
    api.get<MonthlyFee>(`/monthly-fees/${id}`),

  getByPassengerId: (passengerId: string) =>
    api.get<MonthlyFee[]>(`/monthly-fees/passenger/${passengerId}`),

  create: (data: any) =>
    api.post<MonthlyFee>('/monthly-fees', data),

  update: (id: string, data: any) =>
    api.put<MonthlyFee>(`/monthly-fees/${id}`, data),

  pay: (id: string, data: { paymentMethod: string; amount: number; paymentDate: string; notes?: string }) =>
    api.post<MonthlyFee & { payment?: Payment; breakdown?: any }>(`/monthly-fees/${id}/pay`, data),

  generateMissing: (month: number, year: number, passengerIds?: string[]) =>
    api.post<{ created: number; skippedExisting: number; skippedInactive: number; skippedVacation: number }>(
      '/monthly-fees/generate',
      { month, year, passengerIds }
    ),

  remove: (id: string) =>
    api.delete<void>(`/monthly-fees/${id}`),
}

// --- Receipts ---
export const realReceipts = {
  list: (filters: ReceiptFilters, page: number, pageSize: number) =>
    api.get<{ data: Receipt[]; total: number }>('/receipts', { ...filters, page, pageSize }),

  summary: () =>
    api.get<{ awaiting: number; approved: number; rejected: number; cancelled: number; total: number }>('/receipts/summary'),

  getByPassengerId: (passengerId: string) =>
    api.get<Receipt[]>(`/receipts/passenger/${passengerId}`),

  getWithHistory: (id: string) =>
    api.get<{ receipt: Receipt; history: any[] }>(`/receipts/${id}`),

  create: (data: any) => {
    if (data instanceof FormData) return api.upload<Receipt>('/receipts', data)
    return api.post<Receipt>('/receipts', data)
  },

  approve: (id: string, data?: any) =>
    api.put<Receipt>(`/receipts/${id}/approve`, data),

  reject: (id: string, reason: string) =>
    api.put<Receipt>(`/receipts/${id}/reject`, { reason }),

  cancel: (id: string, reason: string) =>
    api.put<Receipt>(`/receipts/${id}/cancel`, { reason }),

  replace: (id: string, data: any) =>
    api.put<Receipt>(`/receipts/${id}/replace`, data),
}

// --- Availability ---
export const realAvailability = {
  list: (params?: Record<string, any>) =>
    api.get<{ data: Availability[]; total: number }>('/availability', params),

  my: () =>
    api.get<Availability[]>('/availability/my'),

  active: () =>
    api.get<Availability[]>('/availability/active'),

  summary: () =>
    api.get<any>('/availability/summary'),

  getById: (id: string) =>
    api.get<{ availability: Availability; history: any[] }>(`/availability/${id}`),

  create: (data: any) =>
    api.post<Availability>('/availability', data),

  cancel: (id: string, reason: string) =>
    api.put<Availability>(`/availability/${id}/cancel`, { reason }),
}

// --- Dashboard ---
export const realDashboard = {
  get: () =>
    api.get<DashboardData>('/dashboard'),
}

// --- PIX (Stripe) ---
export const realPix = {
  create: (monthlyFeeId: string) =>
    api.post<{ clientSecret: string; amount: number; currency: string; breakdown: any; paymentIntentId: string }>('/pix/create', { monthlyFeeId }),

  status: (monthlyFeeId: string) =>
    api.get<{ status: string }>('/pix/status', { monthlyFeeId }),
}

// --- Communication ---
export const realCommunication = {
  list: () =>
    api.get<any[]>('/communication'),

  create: (data: any) =>
    api.post<any>('/communication', data),

  notifications: () =>
    api.get<any[]>('/communication/notifications'),

  channels: () =>
    api.get<any[]>('/communication/channels'),
}

// --- Settings ---
export const realSettings = {
  get: () =>
    api.get<any>('/settings'),

  update: (category: string, data: any) =>
    api.put<any>(`/settings/${category}`, data),

  auditLogs: (page: number, pageSize: number) =>
    api.get<{ data: any[]; total: number }>('/settings/audit', { page, pageSize }),

  users: () =>
    api.get<any[]>('/settings/users'),

  backup: () =>
    api.post<{ id: string; timestamp: string; size: number }>('/settings/backup'),
}

// --- Health ---
export const realHealth = {
  check: () =>
    api.get<any>('/health', undefined, true),
}
