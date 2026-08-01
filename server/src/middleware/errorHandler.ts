import { logger } from '../utils/logger.js'
import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err: err instanceof Error ? { message: err.message, stack: err.stack } : err }, 'Unhandled error')

  const status = (err as any).status || 500
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
  })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' })
}
