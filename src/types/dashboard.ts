export interface FinancialSummary {
  expectedRevenue: number
  receivedRevenue: number
  pendingAmount: number
  overdueAmount: number
  receivedPercentage: number
  month: string
}

export interface Statistic {
  id: string
  title: string
  value: string
  description: string
  icon: string
  change: number
  changeType: 'increase' | 'decrease'
  color: string
}

export interface Activity {
  id: string
  person: string
  initials: string
  description: string
  time: string
  type: 'payment' | 'document' | 'vacation' | 'register'
}

export interface UpcomingPayment {
  id: string
  name: string
  initials: string
  dueDate: string
  value: number
  daysRemaining: number
}

export interface Notification {
  id: string
  title: string
  message: string
  time: string
  type: 'payment' | 'due' | 'document' | 'system'
  read: boolean
}

export type Period = 'today' | 'week' | 'month' | 'year'

export type ChartPeriod = '7d' | '30d' | '12m'

export interface ChartDataPoint {
  label: string
  receita: number
  pagamentos: number
  inadimplencia: number
}

export interface DashboardData {
  financialSummary: FinancialSummary
  statistics: Statistic[]
  recentActivities: Activity[]
  upcomingPayments: UpcomingPayment[]
  notifications: Notification[]
  chartData: ChartDataPoint[]
}
