import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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
import { pixRouter, handleStripeWebhook } from './routes/pix.js'
import { startScheduler } from './services/scheduler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = Number(process.env.PORT) || 3001

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))

// Stripe webhook (precisa do body raw, antes do express.json)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(sanitizeBody)

// Migrations
await runMigrations()

// Public routes
app.use('/api/auth', authRoutes)

// Protected routes
app.use('/api/passengers', authMiddleware, passengerRoutes)
app.use('/api/monthly-fees', authMiddleware, monthlyFeeRoutes)
app.use('/api/receipts', authMiddleware, receiptRoutes)
app.use('/api/availability', authMiddleware, availabilityRoutes)
app.use('/api/dashboard', authMiddleware, dashboardRoutes)
app.use('/api/communication', authMiddleware, communicationRoutes)
app.use('/api/settings', authMiddleware, settingsRoutes)
app.use('/api/pix', authMiddleware, pixRouter)

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
