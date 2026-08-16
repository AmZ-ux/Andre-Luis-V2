import { getDb } from '../database/connection.js'

export interface AppSettings {
  company: Record<string, string>
  financial: {
    currency: string
    currencyFormat: string
    decimalPlaces: number
    defaultDueDay: number
    allowCustomDueDate: boolean
    defaultMonthlyFee: number
    allowDiscount: boolean
    allowLateFee: boolean
    allowInterest: boolean
  }
  billing: {
    toleranceDays: number
    autoChargeInterest: boolean
    autoChargeLateFee: boolean
    allowExemption: boolean
    allowPartialPayment: boolean
    allowAnticipation: boolean
    allowRenegotiation: boolean
    vacationPolicy: 'no_charge' | 'proportional' | 'full' | 'manual'
    lateFeePercent: number
    interestRatePerDay: number
    reminderDaysBefore: number
  }
  communication: {
    autoMessages: boolean
    language: string
    defaultTemplates: boolean
    signature: string
  }
  security: Record<string, unknown>
  appearance: Record<string, unknown>
  system: Record<string, unknown>
  users: Record<string, unknown>
  [key: string]: unknown
}

export const DEFAULT_SETTINGS: AppSettings = {
  company: { name: 'Transporte André Luis', tradingName: 'Transporte André Luis', cnpj: '', phone: '', whatsapp: '', email: '', website: '', address: '', city: '', state: '', zipCode: '', logo: '', coverImage: '', description: '' },
  financial: { currency: 'BRL', currencyFormat: 'BRL', decimalPlaces: 2, defaultDueDay: 5, allowCustomDueDate: true, defaultMonthlyFee: 189.90, allowDiscount: false, allowLateFee: false, allowInterest: false },
  billing: { toleranceDays: 0, autoChargeInterest: false, autoChargeLateFee: false, allowExemption: true, allowPartialPayment: false, allowAnticipation: false, allowRenegotiation: false, vacationPolicy: 'no_charge', lateFeePercent: 2, interestRatePerDay: 0.033, reminderDaysBefore: 5 },
  communication: { autoMessages: false, language: 'pt-BR', defaultTemplates: true, signature: '' },
  security: { sessionTimeoutMinutes: 30, forcePasswordChangeDays: 90, maxLoginAttempts: 5, autoBlockMinutes: 15, logRetentionDays: 90 },
  appearance: { logo: '', systemName: 'Transporte André Luis', theme: 'system', primaryColor: '#13679C', secondaryColor: '#F8F8F6' },
  system: { language: 'pt-BR', timezone: 'America/Sao_Paulo', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', firstDayOfWeek: 0 },
  users: { admins: 1, operators: 0, roles: [{ name: 'admin', permissions: ['*'] }] },
}

function mergeDefaults(): AppSettings {
  const result: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  return result
}

export function loadSettings(db: any = getDb()): AppSettings {
  const rows = db.prepare('SELECT * FROM settings').all() as any[]
  const settings = mergeDefaults()
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.data)
      if (parsed && typeof parsed === 'object' && row.category in settings) {
        settings[row.category as keyof AppSettings] = {
          ...(settings[row.category as keyof AppSettings] as object),
          ...parsed,
        } as never
      }
    } catch { /* ignore malformed settings */ }
  }
  return settings
}
