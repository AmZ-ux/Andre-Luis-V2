import { runMigrations } from './schema.js'
import { logger } from '../utils/logger.js'

try {
  await runMigrations()
  logger.info('Migration done')
} catch (err) {
  logger.error({ err }, 'Migration failed')
  process.exit(1)
}
