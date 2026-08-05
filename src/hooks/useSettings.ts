import { useState, useEffect, useCallback } from 'react'
import { settingsService } from '../services/settingsService'
import { auditService } from '../services/auditService'
import { logsService } from '../services/logsService'
import { backupService } from '../services/backupService'
import type {
  AppSettings, AuditEntry, LogEntry, BackupEntry, SettingsCategory,
} from '../types/settings'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(settingsService.getAll())
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [activeCategory, setActiveCategory] = useState<SettingsCategory | null>(null)
  const [loading] = useState(false)
  const [saved, setSaved] = useState(false)

  const reload = useCallback(() => {
    setSettings(settingsService.getAll())
    setAuditLog(auditService.list())
    setLogs(logsService.list())
    setBackups(backupService.list())
  }, [])

  useEffect(() => { reload() }, [reload])

  const updateCategory = useCallback(<K extends keyof AppSettings>(
    category: K,
    values: Partial<AppSettings[K]>,
    changedBy?: string
  ) => {
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
  }, [reload])

  const createBackup = useCallback(() => {
    backupService.create('manual')
    logsService.add({
      action: 'backup_create',
      description: 'Backup manual criado',
      user: 'admin', role: 'admin', category: 'backup',
    })
    reload()
  }, [reload])

  const restoreBackup = useCallback((id: string) => {
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
  }, [reload])

  const deleteBackup = useCallback((id: string) => {
    backupService.delete(id)
    reload()
  }, [reload])

  return {
    settings, auditLog, logs, backups,
    activeCategory, setActiveCategory,
    loading, saved,
    updateCategory, createBackup, restoreBackup, deleteBackup, reload,
  }
}
