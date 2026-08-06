import os from 'os'
import fs from 'fs'
import path from 'path'

process.env.DATABASE_PATH = ':memory:'
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tal-test-backups-'))
