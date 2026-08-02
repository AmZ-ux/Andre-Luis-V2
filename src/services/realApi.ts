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

  sendVerificationEmailPublic: (email: string) =>
    api.post<{ success: boolean; demoCode?: string; alreadyVerified?: boolean }>('/auth/verify-email/send-public', { email }, true),

  confirmVerificationEmailPublic: (email: string, code: string) =>
    api.post<{ success: boolean }>('/auth/verify-email/confirm-public', { email, code }, true),

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

// --- Admin management (super admin) ---
export interface AdminUser {
  id: string
  name: string
  email: string
  phone: string
  role: string
  superAdmin: boolean
  emailVerified: boolean
  lastAccess: string
  createdAt: string
}

export const realAdmin = {
  list: () => api.get<AdminUser[]>('/admin/admins'),

  create: (data: { name: string; email: string; password: string }) =>
    api.post<AdminUser>('/admin/admins', data),

  promote: (userId: string) =>
    api.post<{ success: boolean }>('/admin/promote', { userId }),

  demote: (userId: string) =>
    api.post<{ success: boolean }>('/admin/demote', { userId }),
}

// --- Passengers ---
// O servidor guarda/retorna endereco em campos achatados (zip_code, street, ...),
// enquanto o frontend usa um objeto aninhado `address`. Mapeamento abaixo.
function toPassengerAddress(p: any): Passenger {
  const { zipCode, street, number, complement, neighborhood, city, state, ...rest } = p
  return {
    ...rest,
    address: {
      zipCode: zipCode || '',
      street: street || '',
      number: number || '',
      complement: complement || '',
      neighborhood: neighborhood || '',
      city: city || '',
      state: state || '',
    },
  }
}

function flattenPassenger(data: any): any {
  const { address, ...rest } = data
  return {
    ...rest,
    zipCode: address?.zipCode || '',
    street: address?.street || '',
    number: address?.number || '',
    complement: address?.complement || '',
    neighborhood: address?.neighborhood || '',
    city: address?.city || '',
    state: address?.state || '',
  }
}

export const realPassengers = {
  list: async (filters: PassengerFilters, sort: SortState, page: number, pageSize: number) => {
    const r = await api.get<{ data: any[]; total: number }>('/passengers', { ...filters, sortField: sort.field, sortDirection: sort.direction, page, pageSize })
    return { data: r.data.map(toPassengerAddress), total: r.total }
  },

  getById: async (id: string) =>
    toPassengerAddress(await api.get<any>(`/passengers/${id}`)),

  create: async (data: Omit<Passenger, 'id' | 'createdAt' | 'updatedAt'>) =>
    toPassengerAddress(await api.post<any>('/passengers', flattenPassenger(data))),

  update: async (id: string, data: Partial<Passenger>) =>
    toPassengerAddress(await api.put<any>(`/passengers/${id}`, flattenPassenger(data))),

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

  ensureCurrent: () =>
    api.post<{ next: MonthlyFee | null; created: number }>('/monthly-fees/ensure-current'),

  create: (data: any) =>
    api.post<MonthlyFee>('/monthly-fees', data),

  update: (id: string, data: any) =>
    api.put<MonthlyFee>(`/monthly-fees/${id}`, data),

  pay: (id: string, data: { paymentMethod: string; amount: number; paymentDate: string; notes?: string }) =>
    api.post<MonthlyFee & { payment?: Payment; breakdown?: any }>(`/monthly-fees/${id}/pay`, data),

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

// --- Pagamentos (Stripe: PIX e cartão) ---
export const realPayments = {
  create: (monthlyFeeId: string, method: 'pix' | 'card' = 'pix') =>
    api.post<{ clientSecret: string; amount: number; currency: string; breakdown: any; paymentIntentId: string; method: 'pix' | 'card' }>('/payments/create', { monthlyFeeId, method }),

  status: (monthlyFeeId: string) =>
    api.get<{ status: string }>('/payments/status', { monthlyFeeId }),
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
