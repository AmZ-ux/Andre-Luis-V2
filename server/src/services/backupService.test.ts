import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import zlib from 'zlib'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb } from '../database/connection.js'

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

import { createBackup, uploadBackupOffsite, isOffsiteConfigured } from './backupService.js'

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
