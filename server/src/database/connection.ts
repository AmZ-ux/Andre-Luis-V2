import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data')
export const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(DATA_DIR, 'backups')
const DB_PATH = process.env.DATABASE_PATH
  ? (process.env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(process.env.DATABASE_PATH))
  : path.resolve(DATA_DIR, 'database.sqlite')

const isMemory = DB_PATH === ':memory:'

let db: Database.Database | null = null

export class Statement {
  private db: Database.Database
  private sql: string
  private stmt: Database.Statement | null

  constructor(db: Database.Database, sql: string) {
    this.db = db
    this.sql = sql
    this.stmt = db.prepare(sql)
  }

  private ensure(): Database.Statement {
    if (!this.stmt) this.stmt = this.db.prepare(this.sql)
    return this.stmt
  }

  all(...params: any[]): any[] {
    return this.ensure().all(...params)
  }

  get(...params: any[]): any | undefined {
    return this.ensure().get(...params)
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const result = this.ensure().run(...params)
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) }
  }
}

export class DatabaseWrapper {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql)
  }

  run(sql: string, ...params: any[]): void {
    if (params.length > 0 && Array.isArray(params[0])) {
      this.db.prepare(sql).run(params[0])
    } else if (params.length > 0) {
      this.db.prepare(sql).run(...params)
    } else {
      this.db.prepare(sql).run()
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return this.db.transaction(fn) as unknown as T
  }

  close(): void {
    this.db.close()
  }
}

let cachedDb: DatabaseWrapper | null = null

export async function initDatabase(): Promise<void> {
  if (cachedDb) return

  if (!isMemory && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  // sql.js nao aplicava foreign keys; manter mesmo comportamento para nao quebrar
  // insercao em lote (restore de backup, seed) que depende da ordem das tabelas
  db.pragma('foreign_keys = OFF')
  if (!isMemory) {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('busy_timeout = 5000')
  }

  cachedDb = new DatabaseWrapper(db)
}

export function getDb(): DatabaseWrapper {
  if (!cachedDb) throw new Error('Database not initialized. Call initDatabase() first.')
  return cachedDb
}

export function getDbPath(): string {
  return isMemory ? ':memory:' : DB_PATH
}

/** Reset database state - for testing only */
export function resetDb(): void {
  if (db) {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[]
    for (const row of rows) {
      db.exec(`DELETE FROM "${row.name}"`)
    }
  }
}
