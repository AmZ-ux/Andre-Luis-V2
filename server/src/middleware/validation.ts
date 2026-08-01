import type { Request, Response, NextFunction } from 'express'

export function validateBody(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter((f) => !(f in req.body) || String(req.body[f]).trim() === '')
    if (missing.length > 0) {
      res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` })
      return
    }
    next()
  }
}

export function sanitizeInput(value: string): string {
  return value.replace(/[<>]/g, '').trim()
}

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key])
      }
    }
  }
  next()
}
