import type { AppearanceSettings } from '../types/settings'

const STORAGE_KEY = 'app_theme'

const defaults: AppearanceSettings = {
  logo: '',
  systemName: 'Transporte André Luis',
  theme: 'light',
  primaryColor: '#2563EB',
  secondaryColor: '#6B7280',
}

function load(): AppearanceSettings {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  return defaults
}

function save(settings: AppearanceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const themeService = {
  get(): AppearanceSettings {
    return load()
  },

  update(values: Partial<AppearanceSettings>): AppearanceSettings {
    const current = load()
    const updated = { ...current, ...values }
    save(updated)
    return updated
  },

  reset(): void {
    save(defaults)
  },
}
