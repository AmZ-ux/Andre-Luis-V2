export type Environment = 'development' | 'staging' | 'production'

interface AppConfig {
  realApi: boolean
  env: Environment
  appName: string
  appVersion: string
  apiUrl: string
  logLevel: string
  isProduction: boolean
  isDevelopment: boolean
  isStaging: boolean
  sessionTimeout: number
  maxLoginAttempts: number
  loginBlockDuration: number
  maxFileSize: number
  allowedFileTypes: string[]
  pagination: {
    defaultPageSize: number
    maxPageSize: number
  }
  cache: {
    ttl: number
    storagePrefix: string
  }
  monitoring: {
    enabled: boolean
    interval: number
  }
  backup: {
    retentionDays: number
    maxBackups: number
  }
}

export function getConfig(): AppConfig {
  const env = (import.meta.env.VITE_APP_ENV as Environment) || 'development'

  const realApi = import.meta.env.VITE_REAL_API === 'true'

  return {
    realApi,
    env,
    appName: import.meta.env.VITE_APP_NAME || 'Transporte André Luis',
    appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
    apiUrl: import.meta.env.VITE_API_URL || '',
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
    isProduction: env === 'production',
    isDevelopment: env === 'development',
    isStaging: env === 'staging',
    sessionTimeout: Number(import.meta.env.VITE_SESSION_TIMEOUT) || 30 * 60 * 1000,
    maxLoginAttempts: Number(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS) || 5,
    loginBlockDuration: Number(import.meta.env.VITE_LOGIN_BLOCK_DURATION) || 15 * 60 * 1000,
    maxFileSize: Number(import.meta.env.VITE_MAX_FILE_SIZE) || 5 * 1024 * 1024,
    allowedFileTypes: (import.meta.env.VITE_ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(','),
    pagination: {
      defaultPageSize: Number(import.meta.env.VITE_PAGE_SIZE) || 15,
      maxPageSize: Number(import.meta.env.VITE_MAX_PAGE_SIZE) || 100,
    },
    cache: {
      ttl: Number(import.meta.env.VITE_CACHE_TTL) || 5 * 60 * 1000,
      storagePrefix: import.meta.env.VITE_CACHE_PREFIX || 'app_cache_',
    },
    monitoring: {
      enabled: import.meta.env.VITE_MONITORING_ENABLED === 'true',
      interval: Number(import.meta.env.VITE_MONITORING_INTERVAL) || 30000,
    },
    backup: {
      retentionDays: Number(import.meta.env.VITE_BACKUP_RETENTION_DAYS) || 30,
      maxBackups: Number(import.meta.env.VITE_MAX_BACKUPS) || 10,
    },
  }
}

export const config = getConfig()
