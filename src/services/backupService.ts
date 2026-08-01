import type { BackupEntry } from '../types/settings'

const STORAGE_KEY = 'app_backups'

function generateId(): string {
  return `bak-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function load(): BackupEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function save(entries: BackupEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const backupService = {
  list(): BackupEntry[] {
    return load().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  create(type: 'manual' | 'automatic' = 'manual'): BackupEntry {
    const entry: BackupEntry = {
      id: generateId(),
      filename: `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`,
      size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
      createdAt: new Date().toISOString(),
      type,
    }
    const entries = load()
    entries.unshift(entry)
    save(entries)
    return entry
  },

  restore(id: string): boolean {
    const entry = load().find((b) => b.id === id)
    return !!entry
  },

  delete(id: string): void {
    save(load().filter((b) => b.id !== id))
  },
}
