import type { TransportType, PaymentMethod } from './passenger'

export type ReportCategory = 'financial' | 'passengers' | 'availability' | 'custom'
export type ReportPeriod = 'month' | 'year' | 'custom'
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'donut'

export interface ReportIndicator {
  label: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: string
}

export interface ReportCard {
  id: string
  title: string
  description: string
  category: ReportCategory
  icon: string
  available: boolean
}

export interface ReportFilters {
  period: ReportPeriod
  month: string
  year: string
  startDate: string
  endDate: string
  city: string
  institution: string
  company: string
  transportType: TransportType | ''
  passenger: string
  status: string
  paymentMethod: PaymentMethod | ''
}

export interface ReportData {
  indicators: ReportIndicator[]
  chartData: Record<string, unknown>[]
  tableData: Record<string, unknown>[]
  tableColumns: { key: string; label: string; align?: 'left' | 'center' | 'right' }[]
  title: string
}

export interface FinancialSummary {
  totalPrevisto: number
  totalRecebido: number
  totalPendente: number
  totalAtrasado: number
  inadimplencia: number
  percentualRecebido: number
  totalPassageiros: number
  contratosAtivos: number
  totalMensalidades: number
  totalPagamentos: number
  monthlyBreakdown: { month: string; previsto: number; recebido: number; pendente: number; atrasado: number }[]
  paymentMethodBreakdown: { method: string; total: number; count: number }[]
  statusBreakdown: { status: string; total: number; count: number }[]
}

export interface PassengerReportData {
  ativos: number
  inativos: number
  ferias: number
  bloqueados: number
  total: number
  byCity: { name: string; count: number }[]
  byInstitution: { name: string; count: number }[]
  byCompany: { name: string; count: number }[]
  byTransportType: { type: string; count: number }[]
}

export interface AvailabilityReportData {
  active: number
  scheduled: number
  finished: number
  cancelled: number
  total: number
  returningToday: number
  byMonth: { month: string; count: number }[]
}

export const REPORT_CATEGORIES: { key: ReportCategory; label: string }[] = [
  { key: 'financial', label: 'Financeiro' },
  { key: 'passengers', label: 'Passageiros' },
  { key: 'availability', label: 'Disponibilidade' },
  { key: 'custom', label: 'Personalizados' },
]
