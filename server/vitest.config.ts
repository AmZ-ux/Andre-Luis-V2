import { defineConfig } from 'vitest/config'
import os from 'os'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      DATABASE_PATH: ':memory:',
      BACKUP_DIR: path.join(os.tmpdir(), 'tl-server-tests-backups'),
    },
  },
})
