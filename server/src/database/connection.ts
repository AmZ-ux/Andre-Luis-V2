import initSqlJs, { type SqlJsStatic, type Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const DB_PATH = process.env.DATABASE_PATH
  ? (process.env.DATABASE_PATH === ':memory:' ? ':memory:' : path.resolve(process.env.DATABASE_PATH))
  : path.resolve(DATA_DIR, 'database.sqlite')

const isMemory = DB_PATH === ':memory:'

let SQL: SqlJsStatic | null = null
let db: SqlJsDatabase | null = null

export class Statement {
  private db: SqlJsDatabase
  private sql: string
  private stmt: any

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db
    this.sql = sql
    this.stmt = db.prepare(sql)
  }

  private ensure(): void {
    if (!this.stmt) this.stmt = this.db.prepare(this.sql)
  }

  all(...params: any[]): any[] {
    this.ensure()
    if (params.length > 0) this.stmt.bind(params)
    const rows: any[] = []
    while (this.stmt.step()) {
      rows.push(this.stmt.getAsObject())
    }
    this.stmt.free()
    this.stmt = null
    return rows
  }

  get(...params: any[]): any | undefined {
    this.ensure()
    if (params.length > 0) this.stmt.bind(params)
    let row: any | undefined
    if (this.stmt.step()) {
      row = this.stmt.getAsObject()
    }
    this.stmt.free()
    this.stmt = null
    return row
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    this.ensure()
    this.stmt.reset()
    if (params.length > 0) this.stmt.bind(params)
    this.stmt.step()
    this.stmt.free()
    this.stmt = null
    saveDb()
    return { changes: 0, lastInsertRowid: 0 }
  }
}

class Database {
  private db: SqlJsDatabase

  constructor(db: SqlJsDatabase) {
    this.db = db
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql)
  }

  run(sql: string, ...params: any[]): void {
    if (params.length > 0 && Array.isArray(params[0])) {
      this.db.run(sql, params[0])
    } else {
      this.db.run(sql, params)
    }
    saveDb()
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  export(): Uint8Array {
    return this.db.export()
  }

  close(): void {
    this.db.close()
  }
}

let cachedDb: Database | null = null

export async function initDatabase(): Promise<void> {
  if (cachedDb) return

  if (!SQL) {
    SQL = await initSqlJs()
  }

  let sqlDb: SqlJsDatabase
  if (isMemory) {
    sqlDb = new SQL.Database()
  } else {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH)
      sqlDb = new SQL.Database(buffer)
    } else {
      sqlDb = new SQL.Database()
    }
  }

  db = sqlDb
  cachedDb = new Database(sqlDb)
}

export function getDb(): Database {
  if (!cachedDb) throw new Error('Database not initialized. Call initDatabase() first.')
  return cachedDb
}

export function saveDb(): void {
  if (!cachedDb || isMemory || !db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

export function getDbPath(): string {
  return isMemory ? ':memory:' : DB_PATH
}

/** Reset database state - for testing only */
export function resetDb(): void {
  if (db) {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    if (result.length > 0) {
      const names = result[0].values.map((r: any) => r[0])
      for (const name of names) db.run(`DELETE FROM "${name}"`)
    }
  }
}
