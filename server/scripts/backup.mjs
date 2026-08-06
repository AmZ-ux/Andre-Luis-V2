#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.resolve(__dirname, '../backups')
const DB_FILE = path.resolve(__dirname, '..', process.env.DATABASE_PATH || 'data/database.sqlite')
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10)

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sqlite`)

if (fs.existsSync(DB_FILE)) {
  // Checkpoint do WAL antes de copiar: garante snapshot consistente
  const db = new Database(DB_FILE, { readonly: true })
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
  } finally {
    db.close()
  }
  fs.copyFileSync(DB_FILE, backupFile)
  console.log(`Backup created: ${backupFile} (${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB)`)
} else {
  console.error(`Database not found at ${DB_FILE}`)
  process.exit(1)
}

const files = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.startsWith('backup-'))
  .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
  .sort((a, b) => b.time - a.time)

if (files.length > MAX_BACKUPS) {
  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, file.name))
    console.log(`Removed old backup: ${file.name}`)
  }
}
