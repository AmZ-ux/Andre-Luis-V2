import type { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Apenas administradores' })
    return
  }
  next()
}
