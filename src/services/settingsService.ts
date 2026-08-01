import type { AppSettings } from '../types/settings'
import { auditService } from './auditService'
import type { SettingsCategory } from '../types/settings'

const STORAGE_KEY = 'app_settings'

const defaults: AppSettings = {
  company: {
    name: 'Transporte André Luis', tradingName: 'Transportes André Luis', cnpj: '00.000.000/0001-00',
    phone: '(11) 99999-8888', whatsapp: '(11) 99999-8888', email: 'contato@transportesandreluis.com.br',
    website: 'https://transportesandreluis.com.br', address: 'Rua Exemplo, 123', city: 'São Paulo',
    state: 'SP', zipCode: '01000-000', logo: '', coverImage: '', description: 'Transporte escolar e universitário',
  },
  financial: {
    currency: 'BRL', currencyFormat: 'BRL', decimalPlaces: 2, defaultDueDay: 10,
    allowCustomDueDate: true, defaultMonthlyFee: 150, allowDiscount: true, allowLateFee: true, allowInterest: true,
  },
  billing: {
    toleranceDays: 5, autoChargeInterest: true, autoChargeLateFee: true, allowExemption: true,
    allowPartialPayment: false, allowAnticipation: true, allowRenegotiation: true, vacationPolicy: 'manual',
  },
  communication: { autoMessages: true, language: 'pt-BR', defaultTemplates: true, signature: 'Atenciosamente, Transporte André Luis' },
  security: { sessionTimeoutMinutes: 30, forcePasswordChangeDays: 90, maxLoginAttempts: 5, autoBlockMinutes: 15, logRetentionDays: 90 },
  appearance: { logo: '', systemName: 'Transporte André Luis', theme: 'light', primaryColor: '#2563EB', secondaryColor: '#6B7280' },
  system: { language: 'pt-BR', timezone: 'America/Sao_Paulo', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', firstDayOfWeek: 0 },
  users: { admins: 1, operators: 0, roles: [{ name: 'admin', permissions: ['all'] }, { name: 'operator', permissions: ['passengers', 'payments'] }] },
}

function load(): AppSettings {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  return defaults
}

function save(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const settingsService = {
  getAll(): AppSettings {
    return load()
  },

  get<K extends keyof AppSettings>(category: K): AppSettings[K] {
    return load()[category]
  },

  update<K extends keyof AppSettings>(
    category: K,
    values: Partial<AppSettings[K]>,
    changedBy?: string
  ): AppSettings[K] {
    const settings = load()
    const previous = { ...settings[category] }
    settings[category] = { ...settings[category], ...values }
    save(settings)

    for (const [key, newVal] of Object.entries(values)) {
      const oldVal = previous[key as keyof typeof previous]
      if (oldVal !== newVal) {
        auditService.add({
          category: category as SettingsCategory,
          field: key,
          previousValue: String(oldVal ?? ''),
          newValue: String(newVal ?? ''),
          changedBy: changedBy || 'admin',
        })
      }
    }

    return settings[category]
  },

  reset(category: keyof AppSettings): void {
    const settings = load()
    settings[category] = defaults[category] as any
    save(settings)
  },

  resetAll(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  },
}
