import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { loadSettings } from './settingsService.js'
import { logger } from '../utils/logger.js'

export interface GenerationRequest {
  month: number
  year: number
  passengerIds?: string[]
}

export interface GenerationResult {
  created: number
  skippedExisting: number
  skippedInactive: number
  skippedVacation: number
}

export function parseBrDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
}

function isMonthContained(
  month: number,
  year: number,
  startDate: string,
  endDate: string
): boolean {
  const start = parseBrDate(startDate)
  const end = parseBrDate(endDate)
  if (!start || !end) return false
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  return start <= monthEnd && end >= monthStart
}

const FIXED_VACATION_MONTHS = [1, 7, 12]

export function generateMonthlyFees(request: GenerationRequest, db: any = getDb()): GenerationResult {
  const { month, year, passengerIds } = request
  const settings = loadSettings(db)
  const vacationPolicy = settings.billing.vacationPolicy
  const result: GenerationResult = { created: 0, skippedExisting: 0, skippedInactive: 0, skippedVacation: 0 }

  const rows = db.prepare('SELECT * FROM passengers').all() as any[]
  let candidates = rows
  if (passengerIds && passengerIds.length > 0) {
    candidates = candidates.filter((p) => passengerIds.includes(p.id))
  }

  const allAvailabilities = db.prepare("SELECT * FROM availabilities WHERE status != 'cancelled'").all() as any[]

  const insert = db.prepare(`
    INSERT INTO monthly_fees (id, passenger_id, passenger_name, cpf, transport_type, institution, company, month, year, amount, due_day, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `)

  for (const passenger of candidates) {
    const exists = db.prepare('SELECT id FROM monthly_fees WHERE passenger_id = ? AND month = ? AND year = ?').get(passenger.id, month, year)
    if (exists) { result.skippedExisting++; continue }

    if (passenger.status === 'inactive' || passenger.status === 'blocked') { result.skippedInactive++; continue }

    const onVacation = vacationPolicy === 'no_charge' && (
      (passenger.status === 'vacation' && FIXED_VACATION_MONTHS.includes(month)) ||
      allAvailabilities.some((av: any) =>
        av.passenger_id === passenger.id &&
        isMonthContained(month, year, av.start_date, av.end_date)
      )
    )
    if (onVacation) { result.skippedVacation++; continue }

    insert.run(
      uuid(),
      passenger.id,
      passenger.name,
      passenger.cpf,
      passenger.transport_type,
      passenger.institution || '',
      passenger.company || '',
      month,
      year,
      Number(passenger.monthly_fee) || 0,
      Number(passenger.due_day) || 1,
      `${String(Number(passenger.due_day) || 1).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    )
    result.created++
  }

  if (result.created > 0) {
    logger.info({ month, year, ...result }, 'Monthly fees generated')
  }

  return result
}

const MAX_CONTRACT_CYCLES = 60

// Garante a serie de mensalidades de UM passageiro a partir do seu contrato:
// a primeira competencia e o mes do inicio do contrato (o mes de entrada ja e
// cobrado), e as demais sao criadas um ciclo por mes ate o mes corrente.
export function ensureContractFees(passengerId: string, db: any = getDb()): GenerationResult {
  const result: GenerationResult = { created: 0, skippedExisting: 0, skippedInactive: 0, skippedVacation: 0 }

  const passenger = db.prepare('SELECT * FROM passengers WHERE id = ?').get(passengerId) as any
  if (!passenger || passenger.status === 'inactive' || passenger.status === 'blocked') {
    result.skippedInactive++
    return result
  }

  const now = new Date()
  const nowMonth = now.getMonth() + 1
  const nowYear = now.getFullYear()

  let firstYear: number
  let firstMonth: number
  const start = passenger.contract_start_date
  if (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const [y, m] = start.split('-').map(Number)
    firstMonth = m
    firstYear = y
  } else {
    firstYear = nowYear
    firstMonth = nowMonth
  }

  let y = firstYear
  let m = firstMonth
  let cycles = 0
  while (y < nowYear || (y === nowYear && m <= nowMonth)) {
    if (cycles >= MAX_CONTRACT_CYCLES) break
    const r = generateMonthlyFees({ month: m, year: y, passengerIds: [passengerId] }, db)
    result.created += r.created
    result.skippedExisting += r.skippedExisting
    result.skippedInactive += r.skippedInactive
    result.skippedVacation += r.skippedVacation
    m++
    if (m > 12) { m = 1; y++ }
    cycles++
  }

  return result
}
