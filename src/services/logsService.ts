import type { LogEntry } from '../types/settings'
import type { UserRole } from '../types/auth'

const STORAGE_KEY = 'app_logs'

function load(): LogEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(entries: LogEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function generateId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

export const logsService = {
  list(category?: string): LogEntry[] {
    const entries = load()
    const filtered = category ? entries.filter((e) => e.category === category) : entries
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  },

  add(data: {
    action: string
    description: string
    user: string
    role: UserRole
    category: string
  }): LogEntry {
    const entry: LogEntry = {
      id: generateId(),
      action: data.action,
      description: data.description,
      user: data.user,
      role: data.role,
      timestamp: formatTimestamp(),
      category: data.category,
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
