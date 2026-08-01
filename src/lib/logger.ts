type LogLevel = 'info' | 'warn' | 'error' | 'critical' | 'audit'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  stack?: string
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  critical: 3,
  audit: 0,
}

const currentLevel: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel]
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry, null, 0)
}

function persistLog(entry: LogEntry): void {
  if (typeof window !== 'undefined') {
    const logs = JSON.parse(sessionStorage.getItem('app_logs') || '[]')
    logs.push(entry)
    if (logs.length > 1000) logs.shift()
    sessionStorage.setItem('app_logs', JSON.stringify(logs))
  }
}

function createEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    ...(level === 'error' || level === 'critical' ? { stack: new Error().stack } : {}),
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('info')) return
    const entry = createEntry('info', message, context)
    console.info(formatLog(entry))
    persistLog(entry)
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('warn')) return
    const entry = createEntry('warn', message, context)
    console.warn(formatLog(entry))
    persistLog(entry)
  },

  error(message: string, context?: Record<string, unknown>) {
    if (!shouldLog('error')) return
    const entry = createEntry('error', message, context)
    console.error(formatLog(entry))
    persistLog(entry)
  },

  critical(message: string, context?: Record<string, unknown>) {
    const entry = createEntry('critical', message, context)
    console.error(formatLog(entry))
    persistLog(entry)
  },

  audit(action: string, userId: string, details?: Record<string, unknown>) {
    const entry = createEntry('audit', action, { userId, ...details })
    console.info(formatLog(entry))
    persistLog(entry)
  },

  getLogs(): LogEntry[] {
    return JSON.parse(sessionStorage.getItem('app_logs') || '[]')
  },

  clearLogs(): void {
    sessionStorage.removeItem('app_logs')
  },
}
