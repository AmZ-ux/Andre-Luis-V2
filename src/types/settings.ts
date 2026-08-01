import type { UserRole } from './auth'

export type SettingsCategory =
  | 'company' | 'financial'
  | 'security' | 'backup' | 'system' | 'users'

export interface CompanySettings {
  name: string
  tradingName: string
  cnpj: string
  phone: string
  whatsapp: string
  email: string
  website: string
  address: string
  city: string
  state: string
  zipCode: string
  logo: string
  coverImage: string
  description: string
}

export interface FinancialSettings {
  currency: string
  currencyFormat: 'BRL' | 'USD' | 'EUR'
  decimalPlaces: number
  defaultDueDay: number
  allowCustomDueDate: boolean
  defaultMonthlyFee: number
  allowDiscount: boolean
  allowLateFee: boolean
  allowInterest: boolean
}

export interface BillingSettings {
  toleranceDays: number
  autoChargeInterest: boolean
  autoChargeLateFee: boolean
  allowExemption: boolean
  allowPartialPayment: boolean
  allowAnticipation: boolean
  allowRenegotiation: boolean
  vacationPolicy: 'no_charge' | 'proportional' | 'full' | 'manual'
}

export interface CommunicationSettings {
  autoMessages: boolean
  language: string
  defaultTemplates: boolean
  signature: string
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number
  forcePasswordChangeDays: number
  maxLoginAttempts: number
  autoBlockMinutes: number
  logRetentionDays: number
}

export interface BackupEntry {
  id: string
  filename: string
  size: string
  createdAt: string
  type: 'manual' | 'automatic'
}

export interface AppearanceSettings {
  logo: string
  systemName: string
  theme: 'light' | 'dark' | 'system'
  primaryColor: string
  secondaryColor: string
}

export interface SystemSettings {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  firstDayOfWeek: 0 | 1 | 6
}

export interface UserSettings {
  admins: number
  operators: number
  roles: { name: string; permissions: string[] }[]
}

export interface AppSettings {
  company: CompanySettings
  financial: FinancialSettings
  billing: BillingSettings
  communication: CommunicationSettings
  security: SecuritySettings
  appearance: AppearanceSettings
  system: SystemSettings
  users: UserSettings
}

export interface AuditEntry {
  id: string
  category: SettingsCategory
  field: string
  previousValue: string
  newValue: string
  changedBy: string
  changedAt: string
  ip: string
}

export interface LogEntry {
  id: string
  action: string
  description: string
  user: string
  role: UserRole
  timestamp: string
  category: string
}

export const SETTINGS_CATEGORIES: { key: SettingsCategory; label: string; icon: string; description: string }[] = [
  { key: 'company', label: 'Empresa', icon: 'Building2', description: 'Informações da empresa' },
  { key: 'financial', label: 'Financeiro', icon: 'DollarSign', description: 'Configurações financeiras' },
  { key: 'system', label: 'Sistema', icon: 'Settings', description: 'Idioma, fuso e formatos' },
  { key: 'security', label: 'Segurança', icon: 'Shield', description: 'Senhas, sessão e bloqueios' },
  { key: 'backup', label: 'Backup', icon: 'HardDrive', description: 'Backup e restauração' },
  { key: 'users', label: 'Usuários', icon: 'Users', description: 'Administradores e operadores' },
]
