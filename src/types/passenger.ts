export type PassengerStatus = 'active' | 'inactive' | 'vacation' | 'blocked'
export type TransportType = 'university' | 'school' | 'contract'
export type PaymentMethod = 'pix' | 'cash' | 'transfer' | 'card'
export type ViewMode = 'list' | 'cards'

export interface Address {
  zipCode: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
}

export interface Passenger {
  id: string
  name: string
  cpf: string
  rg?: string
  birthDate: string
  phone: string
  whatsapp?: string
  email: string
  address: Address
  transportType: TransportType
  institution?: string
  course?: string
  class?: string
  company?: string
  school?: string
  workplace?: string
  monthlyFee: number
  dueDay: number
  paymentMethod: PaymentMethod
  status: PassengerStatus
  pickupPoint?: string
  destination?: string
  contractStartDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PassengerFilters {
  search: string
  status: PassengerStatus | ''
  transportType: TransportType | ''
  city: string
  institution: string
  dueDay: string
  company: string
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface SortState {
  field: 'name' | 'createdAt' | 'city' | 'monthlyFee' | 'dueDay'
  direction: 'asc' | 'desc'
}

export interface PassengerFormData {
  name: string
  cpf: string
  rg: string
  birthDate: string
  phone: string
  whatsapp: string
  email: string
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  transportType: TransportType
  institution: string
  course: string
  class: string
  company: string
  school: string
  workplace: string
  pickupPoint: string
  destination: string
  contractStartDate: string
  monthlyFee: string
  dueDay: string
  paymentMethod: PaymentMethod
  status: PassengerStatus
  notes: string
}
