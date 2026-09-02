import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import zlib from 'zlib'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb, BACKUP_DIR } from '../database/connection.js'

process.env.DATABASE_PATH = ':memory:'
const backupDir = path.join(os.tmpdir(), `tl-backup-test-${Date.now()}`)
process.env.BACKUP_DIR = backupDir

const sent: any[] = []
vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(public config: any) {}
    async send(cmd: any) {
      sent.push(cmd)
      if (cmd.constructor.name === 'ListObjectsV2Command') {
        return { Contents: [
          { Key: 'backups/backup_old.json.gz', LastModified: new Date('2026-01-01T00:00:00Z') },
          { Key: 'backups/backup_new.json.gz', LastModified: new Date('2026-01-02T00:00:00Z') },
        ] }
      }
      return {}
    }
  }
  class PutObjectCommand { constructor(public input: any) {} }
  class ListObjectsV2Command { constructor(public input: any) {} }
  class DeleteObjectsCommand { constructor(public input: any) {} }
  return { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand }
})

import { createBackup, restoreBackup, uploadBackupOffsite, isOffsiteConfigured } from './backupService.js'

describe('backupService off-site', () => {
  beforeAll(async () => {
    await runMigrations()
  })

  beforeEach(() => {
    resetDb()
    sent.length = 0
    process.env.S3_BUCKET = 'test-bucket'
    process.env.S3_ACCESS_KEY_ID = 'test-key'
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret'
    delete process.env.S3_ENDPOINT
    delete process.env.S3_PREFIX
  })

  it('should report not configured without credentials', () => {
    delete process.env.S3_BUCKET
    expect(isOffsiteConfigured()).toBe(false)
  })

  it('should skip upload when S3 is not configured', async () => {
    delete process.env.S3_BUCKET
    const db = getDb()
    const info = createBackup(db, 'manual')
    const result = await uploadBackupOffsite(info.id)
    expect(result).toBe(false)
    expect(sent.length).toBe(0)
  })

  it('should upload gzipped backup and prune old remote files', async () => {
    process.env.MAX_BACKUPS = '1'
    const db = getDb()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(uuid(), 'Offsite Test', '999.999.999-99', '2000-01-01')
    const info = createBackup(db, 'automatic')
    const result = await uploadBackupOffsite(info.id)

    expect(result).toBe(true)
    expect(sent.length).toBe(3)

    const put = sent[0]
    expect(put.constructor.name).toBe('PutObjectCommand')
    expect(put.input.Bucket).toBe('test-bucket')
    expect(put.input.Key).toBe(`backups/backup_${info.id}.json.gz`)
    const gzipped = put.input.Body as Buffer
    const raw = JSON.parse(zlib.gunzipSync(gzipped).toString('utf8'))
    expect(raw.passengers.length).toBe(1)
    expect(raw.passengers[0].name).toBe('Offsite Test')

    const del = sent[2]
    expect(del.constructor.name).toBe('DeleteObjectsCommand')
    expect(del.input.Delete.Objects).toEqual([{ Key: 'backups/backup_old.json.gz' }])
  })

  it('should throw when backup file is missing', async () => {
    await expect(uploadBackupOffsite('missing-id')).rejects.toThrow('Backup não encontrado')
  })
})

describe('restoreBackup atomicity', () => {
  beforeAll(async () => {
    await runMigrations()
  })

  beforeEach(() => {
    resetDb()
  })

  it('restores data from a valid backup', () => {
    const db = getDb()
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(uuid(), 'Original', '111.111.111-11', '2000-01-01')
    const info = createBackup(db, 'manual')

    // Mutate after backup
    db.prepare('DELETE FROM passengers').run()
    expect((db.prepare('SELECT COUNT(*) as c FROM passengers').get() as any).c).toBe(0)

    // Restore
    restoreBackup(db, info.id)
    const row = db.prepare('SELECT name FROM passengers').get() as any
    expect(row.name).toBe('Original')
  })

  it('rolls back completely when INSERT fails mid-restore', () => {
    const db = getDb()

    // Seed original data
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(uuid(), 'Passenger A', '111.111.111-11', '2000-01-01')

    const info = createBackup(db, 'manual')

    // Mutate DB
    db.prepare('DELETE FROM passengers').run()

    // Create a "corrupt" backup with duplicate fee that violates UNIQUE constraint
    const corruptData = JSON.parse(fs.readFileSync(
      path.join(BACKUP_DIR, `backup_${info.id}.json`), 'utf8'
    ))
    // Add two fee entries with same (passenger_id, month, year) — violates UNIQUE
    const sharedPassengerId = uuid()
    corruptData.monthly_fees = [
      { id: uuid(), passenger_id: sharedPassengerId, passenger_name: 'Dup1', cpf: '000.000.000-00',
        transport_type: 'university', month: 8, year: 2026, amount: 100, due_day: 5,
        due_date: '05/08/2026', status: 'pending', notes: '', cancellation_reason: '',
        exemption_reason: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: uuid(), passenger_id: sharedPassengerId, passenger_name: 'Dup2', cpf: '000.000.000-00',
        transport_type: 'university', month: 8, year: 2026, amount: 100, due_day: 5,
        due_date: '05/08/2026', status: 'pending', notes: '', cancellation_reason: '',
        exemption_reason: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]
    corruptData.passengers = [{ id: sharedPassengerId, name: 'Restored', cpf: '222.222.222-22',
      birth_date: '2000-01-01', transport_type: 'university', status: 'active', monthly_fee: 100,
      due_day: 5, phone: '', whatsapp: '', email: '', zip_code: '', street: '', number: '',
      complement: '', neighborhood: '', city: '', state: '', institution: '', course: '',
      class: '', company: '', school: '', workplace: '', payment_method: 'pix', notes: '',
      pickup_point: '', destination: '', contract_start_date: '', created_at: new Date().toISOString(),
      updated_at: new Date().toISOString() }]
    fs.writeFileSync(path.join(BACKUP_DIR, `backup_${info.id}.json`), JSON.stringify(corruptData))

    // Attempt restore — should fail and rollback
    expect(() => restoreBackup(db, info.id)).toThrow()

    // No partial restore: DB should be empty (our DELETE outside tx is permanent,
    // but the restore's DELETE + INSERT all rolled back, so no new data appeared)
    const passengers = db.prepare('SELECT COUNT(*) as c FROM passengers').get() as any
    const fees = db.prepare('SELECT COUNT(*) as c FROM monthly_fees').get() as any
    expect(passengers.c).toBe(0)
    expect(fees.c).toBe(0)
  })

  it('no table is partially restored after a failed restore', () => {
    const db = getDb()
    // Seed with known data
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', 'x')")
      .run(uuid(), 'Admin', 'admin@test.com', '111.111.111-11')
    db.prepare("INSERT INTO passengers (id, name, cpf, birth_date, transport_type, status, monthly_fee, due_day) VALUES (?, ?, ?, ?, 'university', 'active', 100, 5)")
      .run(uuid(), 'Passenger', '222.222.222-22', '2000-01-01')

    const info = createBackup(db, 'manual')

    // Mutate DB
    db.prepare('DELETE FROM users').run()
    db.prepare('DELETE FROM passengers').run()

    // Create backup with data that will fail on UNIQUE constraint
    const corruptData = JSON.parse(fs.readFileSync(
      path.join(BACKUP_DIR, `backup_${info.id}.json`), 'utf8'
    ))
    if (corruptData.monthly_fees && corruptData.monthly_fees.length > 0) {
      corruptData.monthly_fees.push({ ...corruptData.monthly_fees[0], id: uuid() })
    }
    fs.writeFileSync(path.join(BACKUP_DIR, `backup_${info.id}.json`), JSON.stringify(corruptData))

    // Attempt restore
    try { restoreBackup(db, info.id) } catch {}

    // Either both tables are empty (rollback) or both have data (full restore)
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c
    const passengerCount = (db.prepare('SELECT COUNT(*) as c FROM passengers').get() as any).c
    const feeCount = (db.prepare('SELECT COUNT(*) as c FROM monthly_fees').get() as any).c

    const isFullyEmpty = userCount === 0 && passengerCount === 0 && feeCount === 0
    const isFullyRestored = userCount > 0 && passengerCount > 0
    expect(isFullyEmpty || isFullyRestored).toBe(true)
  })
})
