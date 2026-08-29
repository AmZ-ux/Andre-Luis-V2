import type { Request, Response, NextFunction } from 'express'
import { getDb } from '../database/connection.js'

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

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Apenas administradores' })
    return
  }
  const db = getDb()
  const user = db.prepare('SELECT super_admin FROM users WHERE id = ?').get(req.user.userId) as any
  if (!user?.super_admin) {
    res.status(403).json({ error: 'Apenas o super administrador' })
    return
  }
  next()
}
