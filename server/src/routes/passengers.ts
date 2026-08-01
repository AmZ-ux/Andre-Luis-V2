import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { sanitizeInput } from '../middleware/validation.js'

const router = Router()

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

router.post('/', (req, res) => {
  const db = getDb()
  const {
    name, cpf, rg, birthDate, phone, whatsapp, email,
    zipCode, street, number, complement, neighborhood, city, state,
    transportType, institution, course, class: clazz, company, school, workplace,
    monthlyFee, dueDay, paymentMethod, status, notes,
  } = req.body

  // Create both user and passenger accounts
  const id = uuid()
  const userExists = db.prepare('SELECT id FROM users WHERE cpf = ?').get(cpf)
  if (!userExists) {
    db.prepare(`INSERT INTO users (id, name, email, cpf, phone, role, password_hash)
      VALUES (?, ?, ?, ?, ?, 'passenger', ?)`)
      .run(id, sanitizeInput(name), sanitizeInput(email), cpf, sanitizeInput(phone || ''), bcrypt.hashSync('passagem123', 10))
  }

  const passengerId = userExists ? uuid() : id
  db.prepare(`
    INSERT INTO passengers (id, name, cpf, rg, birth_date, phone, whatsapp, email,
      zip_code, street, number, complement, neighborhood, city, state,
      transport_type, institution, course, class, company, school, workplace,
      monthly_fee, due_day, payment_method, status, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    passengerId, sanitizeInput(name), cpf, rg || '', birthDate, sanitizeInput(phone || ''), whatsapp || '',
    sanitizeInput(email || ''), zipCode || '', sanitizeInput(street || ''), number || '', complement || '',
    neighborhood || '', sanitizeInput(city || ''), state || '',
    transportType || 'university', sanitizeInput(institution || ''), course || '', clazz || '',
    sanitizeInput(company || ''), school || '', workplace || '',
    Number(monthlyFee) || 0, Number(dueDay) || 5, paymentMethod || 'pix', status || 'active', notes || ''
  )

  const created = db.prepare('SELECT * FROM passengers WHERE id = ?').get(passengerId)
  res.status(201).json(created)
})

router.put('/:id', (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM passengers WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Passageiro não encontrado' }); return }

  const fields = ['name', 'rg', 'birth_date', 'phone', 'whatsapp', 'email',
    'zip_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state',
    'transport_type', 'institution', 'course', 'class', 'company', 'school', 'workplace',
    'monthly_fee', 'due_day', 'payment_method', 'status', 'notes']

  const sets: string[] = []
  const params: any[] = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`)
      params.push(typeof req.body[f] === 'string' ? sanitizeInput(req.body[f]) : req.body[f])
    }
  }

  if (sets.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return }

  sets.push('updated_at = datetime(\'now\')')
  params.push(req.params.id)

  db.prepare(`UPDATE passengers SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  const updated = db.prepare('SELECT * FROM passengers WHERE id = ?').get(req.params.id)
  res.json(updated)
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM passengers WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
