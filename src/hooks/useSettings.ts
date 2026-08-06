import { useState, useEffect, useCallback } from 'react'
import { config } from '../config'
import { settingsService } from '../services/settingsService'
import { auditService } from '../services/auditService'
import { logsService } from '../services/logsService'
import { backupService } from '../services/backupService'
import { realSettings } from '../services/realApi'
import type {
  AppSettings, AuditEntry, LogEntry, BackupEntry, SettingsCategory,
} from '../types/settings'

interface ServerAuditRow {
  id: string
  category: string
  details: string
  userName: string
  createdAt: string
}

interface ServerLogRow {
  id: string
  action: string
  description: string
  userName: string
  userRole: string
  category: string
  createdAt: string
}

interface ServerBackupRow {
  id: string
  timestamp: string
  size: number
  type: string
}

function toAuditEntry(row: ServerAuditRow): AuditEntry {
  let details: Record<string, any> = {}
  try { details = JSON.parse(row.details || '{}') } catch {}
  return {
    id: row.id,
    category: row.category as SettingsCategory,
    field: String(details.field ?? ''),
    previousValue: String(details.previousValue ?? ''),
    newValue: String(details.newValue ?? ''),
    changedBy: row.userName || 'admin',
    changedAt: row.createdAt || '',
    ip: '',
  }
}

function toLogEntry(row: ServerLogRow): LogEntry {
  return {
    id: row.id,
    action: row.action,
    description: row.description || '',
    user: row.userName || row.userRole || 'admin',
    role: (row.userRole as LogEntry['role']) || 'admin',
    timestamp: row.createdAt || '',
    category: row.category || 'general',
  }
}

function toBackupEntry(row: ServerBackupRow): BackupEntry {
  const sizeKb = row.size ? `${(row.size / 1024).toFixed(1)} KB` : '0 KB'
  return {
    id: row.id,
    filename: `backup-${(row.timestamp || new Date().toISOString()).replace(/[:.]/g, '-')}`,
    size: sizeKb,
    createdAt: row.timestamp || new Date().toISOString(),
    type: row.type === 'automatic' ? 'automatic' : 'manual',
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getAll())
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(null)
  const [loading, setLoading] = useState(config.realApi)
  const [saved, setSaved] = useState(false)

  const reload = useCallback(async () => {
    if (!config.realApi) {
      setSettings(settingsService.getAll())
      setAuditLog(auditService.list())
      setLogs(logsService.list())
      setBackups(backupService.list())
      setLoading(false)
      return
    }

    try {
      const [s, auditRes, logRes, backupRes] = await Promise.all([
        realSettings.get(),
        realSettings.auditLogs(1, 50),
        realSettings.logs(1, 50),
        realSettings.backups(),
      ])
      setSettings(s as AppSettings)
      setAuditLog(auditRes.data.map(toAuditEntry))
      setLogs(logRes.data.map(toLogEntry))
      setBackups(backupRes.map(toBackupEntry))
    } catch {
      // mantém o estado atual em caso de falha da API
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const updateCategory = useCallback(<K extends keyof AppSettings>(
    category: K,
    values: Partial<AppSettings[K]>,
    changedBy?: string
  ) => {
    if (!config.realApi) {
      settingsService.update(category, values, changedBy)
      logsService.add({
        action: 'settings_update',
        description: `Configuração "${category}" alterada`,
        user: changedBy || 'admin',
        role: 'admin',
        category: String(category),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      reload()
      return
    }

    realSettings.update(String(category), values)
      .then((updated) => {
        setSettings(updated as AppSettings)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch(() => {})
      .finally(() => reload())
  }, [reload])

  const createBackup = useCallback(() => {
    if (!config.realApi) {
      backupService.create('manual')
      logsService.add({
        action: 'backup_create',
        description: 'Backup manual criado',
        user: 'admin', role: 'admin', category: 'backup',
      })
      reload()
      return
    }

    realSettings.backup()
      .then(() => reload())
      .catch(() => {})
  }, [reload])

  const restoreBackup = useCallback((id: string) => {
    if (!config.realApi) {
      const result = backupService.restore(id)
      if (result) {
        logsService.add({
          action: 'backup_restore',
          description: `Backup ${id} restaurado`,
          user: 'admin', role: 'admin', category: 'backup',
        })
      }
      reload()
      return result
    }

    realSettings.restoreBackup(id)
      .then(() => {
        reload()
        return true
      })
      .catch(() => false)
  }, [reload])

  const deleteBackup = useCallback((id: string) => {
    if (!config.realApi) {
      backupService.delete(id)
      reload()
      return
    }

    realSettings.deleteBackup(id)
      .then(() => reload())
      .catch(() => {})
  }, [reload])

  const downloadBackup = useCallback((id: string) => {
    if (!config.realApi) return
    realSettings.downloadBackup(id).catch(() => {})
  }, [])

  const clearLogs = useCallback(() => {
    if (!config.realApi) {
      logsService.clear()
      reload()
      return
    }

    realSettings.clearLogs()
      .then(() => reload())
      .catch(() => {})
  }, [reload])

  const clearAudit = useCallback(() => {
    if (config.realApi) return
    auditService.clear()
    reload()
  }, [reload])

  return {
    settings, auditLog, logs, backups,
    activeCategory, setActiveCategory,
    loading, saved,
    updateCategory, createBackup, restoreBackup, deleteBackup, downloadBackup, reload,
    clearLogs, clearAudit,
  }
}
