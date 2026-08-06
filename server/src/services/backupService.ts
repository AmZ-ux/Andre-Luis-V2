import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { BACKUP_DIR } from '../database/connection.js'
import type { DatabaseWrapper } from '../database/connection.js'

export interface BackupInfo {
  id: string
  timestamp: string
  size: number
  type: 'manual' | 'automatic'
}

function allTables(db: DatabaseWrapper): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]
  return rows.map((r) => r.name)
}

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

export function isValidBackupId(id: string): boolean {
  return !id.includes('..') && !id.includes('/') && !id.includes('\\')
}

function backupFilePath(id: string): string {
  return path.join(BACKUP_DIR, `backup_${id}.json`)
}

export function createBackup(db: DatabaseWrapper, type: 'manual' | 'automatic'): BackupInfo {
  ensureBackupDir()
  const backup: Record<string, any[]> = {}
  for (const table of allTables(db)) {
    backup[table] = db.prepare(`SELECT * FROM "${table}"`).all()
  }
  const id = uuid()
  const timestamp = new Date().toISOString()
  const filePath = backupFilePath(id)
  fs.writeFileSync(filePath, JSON.stringify({ _meta: { createdAt: timestamp, type }, ...backup }))
  return { id, timestamp, size: fs.statSync(filePath).size, type }
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir()
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().reverse()
  return files.map((f) => {
    const id = f.replace(/^backup_/, '').replace(/\.json$/, '')
    const filePath = path.join(BACKUP_DIR, f)
    const stat = fs.statSync(filePath)
    let meta: { createdAt?: string; type?: string } = {}
    try {
      meta = JSON.parse(fs.readFileSync(filePath, 'utf8'))._meta || {}
    } catch {}
    return {
      id,
      timestamp: meta.createdAt || stat.mtime.toISOString(),
      size: stat.size,
      type: meta.type === 'automatic' ? 'automatic' : 'manual',
    }
  })
}

export function getBackupPath(id: string): string | null {
  if (!isValidBackupId(id)) return null
  const filePath = backupFilePath(id)
  return fs.existsSync(filePath) ? filePath : null
}

export function restoreBackup(db: DatabaseWrapper, id: string): { success: boolean } {
  const filePath = getBackupPath(id)
  if (!filePath) throw new Error('Backup não encontrado')
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const tables = allTables(db)
  for (const table of tables) {
    db.prepare(`DELETE FROM "${table}"`).run()
  }
  for (const table of tables) {
    for (const item of data[table] || []) {
      const columns = Object.keys(item)
      const placeholders = columns.map(() => '?').join(', ')
      db.prepare(`INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map((c) => item[c]))
    }
  }
  return { success: true }
}

export function deleteBackup(id: string): void {
  const filePath = getBackupPath(id)
  if (!filePath) return
  fs.unlinkSync(filePath)
}

export function pruneBackups(maxKeep: number): void {
  ensureBackupDir()
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort()
  while (files.length > maxKeep) {
    fs.unlinkSync(path.join(BACKUP_DIR, files[0]))
    files.shift()
  }
}
