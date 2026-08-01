import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { logger } from '../utils/logger.js'

const router = Router()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições' },
})

// Rota publica de diagnostico: o frontend reporta erros de runtime aqui
// para que aparecam nos logs (railway logs)
router.post('/', limiter, (req, res) => {
  const { message, stack, url, context } = req.body || {}
  const userAgent = req.get('user-agent')
  logger.error(
    {
      clientError: {
        context: typeof context === 'string' ? context.slice(0, 200) : undefined,
        message: typeof message === 'string' ? message.slice(0, 500) : undefined,
        stack: typeof stack === 'string' ? stack.slice(0, 4000) : undefined,
        url: typeof url === 'string' ? url.slice(0, 500) : undefined,
        userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 300) : undefined,
      },
    },
    'Client error reported'
  )
  res.json({ success: true })
})

export default router
