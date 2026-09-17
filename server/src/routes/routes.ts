import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'
import { logger } from '../utils/logger.js'

const router = Router()

function normalizeString(value: string): string {
  return value.trim()
}

function isValidAmount(value: unknown): value is number {
  if (typeof value !== 'number') return false
  if (!Number.isFinite(value)) return false
  if (value <= 0) return false
  return true
}

// GET /api/routes — lista rotas
// Admin: todas (ativas + inativas). Passageiro: somente ativas.
router.get('/', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const isAdmin = req.user.role === 'admin'
  const { includeInactive } = req.query

  let sql = 'SELECT * FROM routes'
  if (!isAdmin) {
    sql += ' WHERE active = 1'
  } else if (includeInactive !== 'true') {
    // Admin default: returns all routes (active + inactive)
    // IncludeInactive=true is also accepted for consistency
  }
  sql += ' ORDER BY origin ASC, destination ASC'

  const rows = db.prepare(sql).all()
  res.json(rows)
})

// GET /api/routes/:id
router.get('/:id', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id)
  if (!route) { res.status(404).json({ error: 'Rota não encontrada' }); return }
  res.json(route)
})

// POST /api/routes — admin cria rota
router.post('/', requireAdmin, (req, res) => {
  const db = getDb()
  const { origin, destination, monthlyAmount } = req.body || {}

  if (!origin || typeof origin !== 'string') {
    res.status(400).json({ error: 'Origem é obrigatória' }); return
  }
  if (!destination || typeof destination !== 'string') {
    res.status(400).json({ error: 'Destino é obrigatório' }); return
  }

  const normOrigin = normalizeString(origin)
  const normDestination = normalizeString(destination)

  if (!normOrigin) {
    res.status(400).json({ error: 'Origem é obrigatória' }); return
  }
  if (!normDestination) {
    res.status(400).json({ error: 'Destino é obrigatório' }); return
  }

  const amount = Number(monthlyAmount)
  if (!isValidAmount(amount)) {
    res.status(400).json({ error: 'Valor da mensalidade inválido. Deve ser um número maior que zero.' }); return
  }

  const existing = db.prepare(
    'SELECT id FROM routes WHERE origin = ? AND destination = ?'
  ).get(normOrigin, normDestination)
  if (existing) {
    res.status(409).json({ error: 'Já existe uma rota com essa origem e destino' }); return
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO routes (id, origin, destination, monthly_amount)
    VALUES (?, ?, ?, ?)
  `).run(id, normOrigin, normDestination, amount)

  const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(id)
  res.status(201).json(route)
})

// PUT /api/routes/:id — admin atualiza rota
router.put('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM routes WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Rota não encontrada' }); return }

  const { origin, destination, monthlyAmount, active } = req.body
  const sets: string[] = ["updated_at = datetime('now')"]
  const params: any[] = []

  if (origin !== undefined) {
    if (typeof origin !== 'string') { res.status(400).json({ error: 'Origem inválida' }); return }
    const norm = normalizeString(origin)
    if (!norm) { res.status(400).json({ error: 'Origem é obrigatória' }); return }
    sets.push('origin = ?'); params.push(norm)
  }
  if (destination !== undefined) {
    if (typeof destination !== 'string') { res.status(400).json({ error: 'Destino inválido' }); return }
    const norm = normalizeString(destination)
    if (!norm) { res.status(400).json({ error: 'Destino é obrigatório' }); return }
    sets.push('destination = ?'); params.push(norm)
  }
  if (monthlyAmount !== undefined) {
    const amount = Number(monthlyAmount)
    if (!isValidAmount(amount)) {
      res.status(400).json({ error: 'Valor da mensalidade inválido. Deve ser um número maior que zero.' }); return
    }
    sets.push('monthly_amount = ?'); params.push(amount)
  }
  if (active !== undefined) {
    sets.push('active = ?'); params.push(active ? 1 : 0)
  }

  if (sets.length === 1) {
    res.status(400).json({ error: 'Nenhum campo para atualizar' }); return
  }

  // Check unique constraint if origin or destination changed
  if (origin !== undefined || destination !== undefined) {
    const currentRoute = db.prepare('SELECT origin, destination FROM routes WHERE id = ?').get(req.params.id) as any
    const checkOrigin = origin !== undefined ? normalizeString(origin) : currentRoute.origin
    const checkDest = destination !== undefined ? normalizeString(destination) : currentRoute.destination
    const dup = db.prepare(
      'SELECT id FROM routes WHERE origin = ? AND destination = ? AND id != ?'
    ).get(checkOrigin, checkDest, req.params.id)
    if (dup) {
      res.status(409).json({ error: 'Já existe uma rota com essa origem e destino' }); return
    }
  }

  params.push(req.params.id)

  // If monthly_amount changed, sync passengers.monthly_fee for linked passengers (transactional)
  if (monthlyAmount !== undefined) {
    const amount = Number(monthlyAmount)
    const currentRoute = db.prepare('SELECT monthly_amount FROM routes WHERE id = ?').get(req.params.id) as any
    if (currentRoute && Number(currentRoute.monthly_amount) !== amount) {
      const runInTransaction = db.transaction(() => {
        db.prepare(`UPDATE routes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
        db.prepare('UPDATE passengers SET monthly_fee = ?, updated_at = datetime(\'now\') WHERE route_id = ?')
          .run(amount, req.params.id)
      })
      runInTransaction()
      const synced = (db.prepare('SELECT COUNT(*) as c FROM passengers WHERE route_id = ?').get(req.params.id) as any).c
      if (synced > 0) logger.info({ routeId: req.params.id, newAmount: amount, synced }, 'Route price synced to linked passengers')
    } else {
      db.prepare(`UPDATE routes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    }
  } else {
    db.prepare(`UPDATE routes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(req.params.id)
  res.json(route)
})

// DELETE /api/routes/:id — soft delete (desativa)
router.delete('/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM routes WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Rota não encontrada' }); return }

  db.prepare("UPDATE routes SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id)
  res.status(204).end()
})

export default router
