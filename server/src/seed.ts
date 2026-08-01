import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { runMigrations } from './database/schema.js'
import { logger } from './utils/logger.js'
import { getDb, saveDb } from './database/connection.js'

await runMigrations()
const db = getDb()

const ADMIN_ID = uuid()
const PASSWORD_HASH = bcrypt.hashSync('admin123', 10)

// Default admin user
db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, cpf, phone, role, password_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(ADMIN_ID, 'Administrador', 'admin@transporte.com', '000.000.000-00', '(11) 99999-9999', 'admin', PASSWORD_HASH)

// Default passenger user
const PASSENGER_ID = uuid()
db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, cpf, phone, role, password_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(PASSENGER_ID, 'João Passageiro', 'passageiro@email.com', '111.111.111-11', '(11) 98888-8888', 'passenger', PASSWORD_HASH)

// Sample passengers
const samplePassengers = [
  { name: 'Maria Silva', cpf: '529.982.247-25', city: 'São Paulo', transportType: 'university', monthlyFee: 189.90, dueDay: 5 },
  { name: 'Carlos Oliveira', cpf: '123.456.789-09', city: 'Guarulhos', transportType: 'school', monthlyFee: 149.90, dueDay: 10 },
  { name: 'Ana Santos', cpf: '987.654.321-00', city: 'Osasco', transportType: 'contract', monthlyFee: 249.90, dueDay: 15 },
  { name: 'Pedro Costa', cpf: '456.789.123-88', city: 'São Bernardo', transportType: 'university', monthlyFee: 189.90, dueDay: 5 },
  { name: 'Julia Pereira', cpf: '321.654.987-77', city: 'Santo André', transportType: 'school', monthlyFee: 149.90, dueDay: 20 },
]

const insertPassenger = db.prepare(`
  INSERT OR IGNORE INTO passengers (id, name, cpf, birth_date, phone, email, city, transport_type, monthly_fee, due_day)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const p of samplePassengers) {
  const id = uuid()
  insertPassenger.run(
    id, p.name, p.cpf, '1990-01-15', '(11) 9' + Math.floor(1000 + Math.random() * 8000) + '-' + Math.floor(1000 + Math.random() * 8000),
    p.name.toLowerCase().replace(' ', '.') + '@email.com', p.city, p.transportType, p.monthlyFee, p.dueDay
  )
}

// Sample monthly fees
const passengers = db.prepare('SELECT * FROM passengers').all() as any[]
const currentDate = new Date()
const currentMonth = currentDate.getMonth() + 1
const currentYear = currentDate.getFullYear()

const insertFee = db.prepare(`
  INSERT OR IGNORE INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, month, year, amount, due_day, due_date, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const p of passengers) {
  for (let m = 0; m < 3; m++) {
    let month = currentMonth - m
    let year = currentYear
    if (month <= 0) { month += 12; year-- }
    const dueDate = `${String(month).padStart(2, '0')}/${year}`
    const status = m === 0 ? 'pending' : m === 1 ? 'paid' : 'overdue'
    insertFee.run(uuid(), p.id, p.name, p.cpf, p.transport_type, month, year, p.monthly_fee, p.due_day, dueDate, status)
  }
}

logger.info({ admin: 'admin@transporte.com', passenger: 'passageiro@email.com' }, 'Database seeded successfully')
saveDb()
