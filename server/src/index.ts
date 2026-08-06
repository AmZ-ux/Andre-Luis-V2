import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { runMigrations } from './database/schema.js'
import { sanitizeBody } from './middleware/validation.js'
import { authMiddleware } from './middleware/auth.js'
import { logger } from './utils/logger.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import passengerRoutes from './routes/passengers.js'
import monthlyFeeRoutes from './routes/monthlyFees.js'
import receiptRoutes from './routes/receipts.js'
import availabilityRoutes from './routes/availability.js'
import dashboardRoutes from './routes/dashboard.js'
import communicationRoutes from './routes/communication.js'
import settingsRoutes from './routes/settings.js'
import reportsRoutes from './routes/reports.js'
import clientErrorRoutes from './routes/clientError.js'
import { paymentsRouter } from './routes/payments.js'
import adminRoutes from './routes/admin.js'
import { startScheduler } from './services/scheduler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// Confia no proxy (Railway) para X-Forwarded-For: necessario para o rate limit identificar IPs reais
app.set('trust proxy', 1)

const PORT = Number(process.env.PORT) || 3001

// Security
const isProduction = process.env.NODE_ENV === 'production'
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      frameSrc: ["'self'"],
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))

// Rate limit global (por IP, com trust proxy para IPs reais)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX) || 300,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api', globalLimiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(sanitizeBody)

// Migrations
await runMigrations()

// Seed em producao: SEED=true executa uma vez (idempotente) no boot
if (process.env.SEED === 'true') {
  const { runSeed } = await import('./services/seedDatabase.js')
  await runSeed()
}

// Public routes
app.use('/api/auth', authRoutes)
app.use('/api/client-error', clientErrorRoutes)

// Protected routes
app.use('/api/passengers', authMiddleware, passengerRoutes)
app.use('/api/monthly-fees', authMiddleware, monthlyFeeRoutes)
app.use('/api/receipts', authMiddleware, receiptRoutes)
app.use('/api/availability', authMiddleware, availabilityRoutes)
app.use('/api/dashboard', authMiddleware, dashboardRoutes)
app.use('/api/communication', authMiddleware, communicationRoutes)
app.use('/api/settings', authMiddleware, settingsRoutes)
app.use('/api/reports', authMiddleware, reportsRoutes)
app.use('/api/payments', authMiddleware, paymentsRouter)

app.use('/api/admin', adminRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })
})

// Serve frontend in production
const distPath = path.resolve(__dirname, '../../dist')
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

const start = async () => {
  try {
    await runMigrations()
    startScheduler()
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server started')
    })
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}
start()

export default app
