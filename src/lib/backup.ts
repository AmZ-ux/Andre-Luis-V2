import { config } from '../config'

interface BackupEntry {
  id: string
  timestamp: string
  type: 'full' | 'partial'
  size: number
  status: 'completed' | 'failed' | 'in_progress'
  metadata: Record<string, string>
}

const BACKUP_KEY = '__app_backups__'

export const backup = {
  list(): BackupEntry[] {
    try {
      return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]')
    } catch {
      return []
    }
  },

  create(type: 'full' | 'partial' = 'full'): BackupEntry {
    const entry: BackupEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      size: new Blob([JSON.stringify(localStorage)]).size,
      status: 'in_progress',
      metadata: {
        appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
        environment: import.meta.env.VITE_APP_ENV || 'development',
      },
    }

    try {
      const data: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('__')) {
          data[key] = localStorage.getItem(key) || ''
        }
      }
      localStorage.setItem(`__backup_${entry.id}`, JSON.stringify(data))
      entry.status = 'completed'
    } catch {
      entry.status = 'failed'
    }

    const backups = this.list()
    backups.push(entry)
    while (backups.length > config.backup.maxBackups) backups.shift()
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups))

    return entry
  },

  restore(backupId: string): boolean {
    try {
      const raw = localStorage.getItem(`__backup_${backupId}`)
      if (!raw) return false
      const data = JSON.parse(raw) as Record<string, string>
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(key, value)
      }
      return true
    } catch {
      return false
    }
  },

  delete(backupId: string): void {
    localStorage.removeItem(`__backup_${backupId}`)
    const backups = this.list().filter((b) => b.id !== backupId)
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups))
  },

  cleanup(): void {
    const backups = this.list()
    const cutoff = Date.now() - config.backup.retentionDays * 24 * 60 * 60 * 1000
    const toDelete = backups.filter((b) => new Date(b.timestamp).getTime() < cutoff)
    for (const b of toDelete) this.delete(b.id)
  },
}
