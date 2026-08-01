import type { AuditEntry, SettingsCategory } from '../types/settings'

const STORAGE_KEY = 'app_audit_log'

function load(): AuditEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(entries: AuditEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function generateId(): string {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const auditService = {
  list(category?: SettingsCategory): AuditEntry[] {
    const entries = load()
    const filtered = category ? entries.filter((e) => e.category === category) : entries
    return filtered.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
  },

  add(data: {
    category: SettingsCategory
    field: string
    previousValue: string
    newValue: string
    changedBy: string
  }): AuditEntry {
    const entry: AuditEntry = {
      id: generateId(),
      category: data.category,
      field: data.field,
      previousValue: data.previousValue,
      newValue: data.newValue,
      changedBy: data.changedBy,
      changedAt: new Date().toISOString(),
      ip: '127.0.0.1',
    }
    const entries = load()
    entries.unshift(entry)
    save(entries)
    return entry
  },

  clear(): void {
    save([])
  },
}
