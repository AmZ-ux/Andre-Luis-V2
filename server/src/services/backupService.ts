import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { v4 as uuid } from 'uuid'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
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

  const runRestore = db.transaction(() => {
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
  })

  runRestore()
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

export function isOffsiteConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  )
}

function offsiteClient(): S3Client | null {
  if (!isOffsiteConfigured()) return null
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  })
}

const offsitePrefix = (): string => process.env.S3_PREFIX || 'backups'

/** Envia um backup local para o bucket S3/R2 configurado (retorna false se nao configurado). */
export async function uploadBackupOffsite(id: string): Promise<boolean> {
  const filePath = getBackupPath(id)
  if (!filePath) throw new Error('Backup não encontrado')
  const client = offsiteClient()
  if (!client) return false
  const bucket = process.env.S3_BUCKET!
  const body = zlib.gzipSync(fs.readFileSync(filePath))
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${offsitePrefix()}/${path.basename(filePath)}.gz`,
    Body: body,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }))
  const maxKeep = Number(process.env.MAX_BACKUPS) || 30
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${offsitePrefix()}/` }))
  const keys = (listed.Contents || [])
    .filter((o) => o.Key)
    .sort((a, b) => (a.LastModified?.getTime() ?? 0) - (b.LastModified?.getTime() ?? 0))
    .map((o) => o.Key!)
  while (keys.length > maxKeep) {
    const old = keys.shift()!
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: old }] } }))
  }
  return true
}
