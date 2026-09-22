import { Router } from 'express'
import { getDb } from '../database/connection.js'
import { sanitizeInput } from '../middleware/validation.js'
import { requireAdmin, requireAuth, requireSuperAdmin } from '../middleware/roles.js'

const router = Router()

// Self-service: o passageiro autenticado carrega SOMENTE o próprio cadastro.
// Deve ficar ANTES de router.use(requireAdmin). Usa exclusivamente req.user.userId
// (do token) — nenhum identificador vindo do cliente. Não expõe notes (uso interno
// administrativo) nem updated_at.
router.get('/me', requireAuth, (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const passenger = db.prepare(`
    SELECT id, name, cpf, birth_date, phone, whatsapp, email,
           zip_code, street, number, complement, neighborhood, city, state,
           transport_type, institution, course, class, company, school, workplace,
           monthly_fee, due_day, payment_method, status,
           pickup_point, destination, contract_start_date, route_id, created_at
    FROM passengers WHERE id = ?
  `).get(req.user.userId)
  if (!passenger) { res.status(404).json({ error: 'Cadastro de passageiro não encontrado' }); return }
  res.json(passenger)
})

router.use(requireAdmin)

router.get('/', (req, res) => {
  const db = getDb()
  const { search = '', status = '', transportType = '', city = '', dueDay = '', page = '1', pageSize = '15', sortField = 'name', sortDirection = 'asc' } = req.query

  let sql = 'SELECT * FROM passengers WHERE 1=1'
  const params: any[] = []

  if (search) { sql += ' AND (name LIKE ? OR cpf LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (transportType) { sql += ' AND transport_type = ?'; params.push(transportType) }
  if (city) { sql += ' AND city LIKE ?'; params.push(`%${city}%`) }
  if (dueDay) { sql += ' AND due_day = ?'; params.push(Number(dueDay)) }

  const wherePart = sql.includes('AND') ? sql.slice(sql.indexOf('AND')) : ''
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM passengers WHERE 1=1 ${wherePart}`).get(...params) as any
  const total = countResult?.total || 0

  const allowedSorts = ['name', 'created_at', 'city', 'monthly_fee', 'due_day']
  const field = allowedSorts.includes(sortField as string) ? sortField : 'name'
  const dir = sortDirection === 'desc' ? 'DESC' : 'ASC'

  const offset = (Number(page) - 1) * Number(pageSize)
  sql += ` ORDER BY ${field} ${dir} LIMIT ? OFFSET ?`
  params.push(Number(pageSize), offset)

  const data = db.prepare(sql).all(...params)
  res.json({ data, total })
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const passenger = db.prepare('SELECT * FROM passengers WHERE id = ?').get(req.params.id)
  if (!passenger) { res.status(404).json({ error: 'Passageiro não encontrado' }); return }
  res.json(passenger)
})

// O cadastro de passageiros é feito exclusivamente pelo próprio passageiro no app
// (POST /api/auth/register), que gera a mensalidade do mês atual automaticamente.
// O administrador não cria passageiros — apenas gerencia os já cadastrados.
router.post('/', (_req, res) => {
  res.status(403).json({
    error: 'O cadastro de passageiro é feito pelo próprio passageiro no app. O administrador não cria passageiros.',
  })
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM passengers WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Passageiro não encontrado' }); return }

  const fields = ['name', 'rg', 'birth_date', 'phone', 'whatsapp', 'email',
    'zip_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state',
    'transport_type', 'institution', 'course', 'class', 'company', 'school', 'workplace',
    'due_day', 'payment_method', 'status', 'notes', 'route_id']

  const allowedStatuses = ['active', 'inactive', 'vacation', 'blocked']
  if (req.body.status !== undefined && !allowedStatuses.includes(req.body.status)) {
    res.status(400).json({ error: 'Status inválido. Valores permitidos: active, inactive, vacation, blocked.' })
    return
  }

  // Validate route_id if provided
  let newRouteId: string | null | undefined = undefined
  if (req.body.route_id !== undefined && req.body.route_id !== null && req.body.route_id !== '') {
    const route = db.prepare('SELECT id, active, monthly_amount FROM routes WHERE id = ?').get(req.body.route_id) as any
    if (!route) {
      res.status(400).json({ error: 'Rota não encontrada' })
      return
    }
    if (!route.active) {
      res.status(400).json({ error: 'Não é possível associar a uma rota inativa' })
      return
    }
    newRouteId = req.body.route_id
  } else if (req.body.route_id === '') {
    newRouteId = null
  }

  const sets: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`)
      params.push(typeof req.body[f] === 'string' ? sanitizeInput(req.body[f]) : req.body[f])
    }
  }

  // Price authority: derive monthly_fee from route when route_id is present
  // monthly_fee is NEVER accepted from client — always derived from route or legacy value
  if (newRouteId !== undefined) {
    if (newRouteId) {
      const route = db.prepare('SELECT monthly_amount FROM routes WHERE id = ?').get(newRouteId) as any
      sets.push('monthly_fee = ?')
      params.push(Number(route.monthly_amount) || 0)
    } else {
      // Removing route — keep existing monthly_fee, do not touch it
    }
  }
  // If no route_id change, do not allow client to set monthly_fee at all

  if (sets.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return }

  sets.push('updated_at = datetime(\'now\')')
  params.push(req.params.id)

  db.prepare(`UPDATE passengers SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  const updated = db.prepare('SELECT * FROM passengers WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.delete('/:id', requireSuperAdmin, (req, res) => {
  const db = getDb()

  // Check passenger exists
  const passenger = db.prepare('SELECT id FROM passengers WHERE id = ?').get(req.params.id)
  if (!passenger) {
    res.status(404).json({ error: 'Passageiro não encontrado' })
    return
  }

  // Check for financial history before any destructive operation
  // Financial history = any paid fee, any payment (NORMAL/SUBPAYMENT/OVERPAYMENT), any succeeded pix_charge
  const hasFinancialHistory = db.prepare(`
    SELECT 1
    FROM monthly_fees mf
    WHERE mf.passenger_id = ?
      AND (
        mf.status = 'paid'
        OR EXISTS (SELECT 1 FROM payments p WHERE p.monthly_fee_id = mf.id)
        OR EXISTS (
          SELECT 1 FROM pix_charges pc
          WHERE pc.monthly_fee_id = mf.id
            AND pc.status IN ('succeeded', 'succeeded_underpaid', 'succeeded_overpaid')
        )
      )
    LIMIT 1
  `).get(req.params.id)

  if (hasFinancialHistory) {
    res.status(409).json({ error: 'Passageiros com histórico financeiro não podem ser excluídos' })
    return
  }

  const feeIds = (db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ?').all(req.params.id) as any[]).map((f) => f.id)
  for (const feeId of feeIds) {
    db.prepare('DELETE FROM pix_charges WHERE monthly_fee_id = ?').run(feeId)
    db.prepare('DELETE FROM payments WHERE monthly_fee_id = ?').run(feeId)
  }

  const availabilityIds = (db.prepare('SELECT id FROM availabilities WHERE passenger_id = ?').all(req.params.id) as any[]).map((a) => a.id)
  for (const aid of availabilityIds) {
    db.prepare('DELETE FROM availability_history WHERE availability_id = ?').run(aid)
  }

  db.prepare('DELETE FROM monthly_fees WHERE passenger_id = ?').run(req.params.id)
  db.prepare('DELETE FROM availabilities WHERE passenger_id = ?').run(req.params.id)
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.params.id)
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  db.prepare('DELETE FROM passengers WHERE id = ?').run(req.params.id)

  res.json({ success: true })
})

export default router
