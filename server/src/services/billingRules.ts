import type { AppSettings } from './settingsService.js'

export interface DueBreakdown {
  principal: number
  lateFee: number
  interest: number
  total: number
  daysLate: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// Regra contratual do proprietário: o vencimento da competência ocorre UM MÊS
// APÓS a competência (início 05/10 → competência 10 → vence 05/11/2026; dia
// maior que o último dia do mês-alvo usa o último dia válido; virada de ano
// respeitada).
export function buildDueDate(year: number, month: number, dueDay: number): Date {
  const dueMonth = month === 12 ? 1 : month + 1
  const dueYear = month === 12 ? year + 1 : year
  const lastDay = new Date(dueYear, dueMonth, 0).getDate()
  return new Date(dueYear, dueMonth - 1, Math.min(dueDay, lastDay))
}

// due_date no formato BR derivado da competência (vencimento = competência + 1).
export function formatDueDateBR(year: number, month: number, dueDay: number): string {
  const d = buildDueDate(year, month, dueDay)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function parseBrDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
}

export function daysLate(dueDate: Date, reference: Date): number {
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const ref = new Date(reference)
  ref.setHours(0, 0, 0, 0)
  return Math.floor((ref.getTime() - due.getTime()) / DAY_MS)
}

export function calculateDueBreakdown(
  amount: number,
  month: number,
  year: number,
  dueDay: number,
  settings: AppSettings,
  referenceDate: Date = new Date()
): DueBreakdown {
  const late = daysLate(buildDueDate(year, month, dueDay), referenceDate)
  const billing = settings.billing
  const tolerance = Math.max(0, Number(billing.toleranceDays) || 0)

  let lateFee = 0
  let interest = 0

  if (late > tolerance) {
    const overdueDays = late - tolerance
    if (billing.autoChargeLateFee) {
      const percent = Math.max(0, Number(billing.lateFeePercent) || 0)
      lateFee = round2((amount * percent) / 100)
    }
    if (billing.autoChargeInterest) {
      const ratePerDay = Math.max(0, Number(billing.interestRatePerDay) || 0)
      interest = round2((amount * ratePerDay * overdueDays) / 100)
    }
  }

  return {
    principal: round2(amount),
    lateFee,
    interest,
    total: round2(amount + lateFee + interest),
    daysLate: late,
  }
}

export function calculateDueFromFee(
  fee: { amount: number; month: number; year: number; due_day: number },
  settings: AppSettings,
  referenceDate: Date = new Date()
): DueBreakdown {
  return calculateDueBreakdown(
    Number(fee.amount) || 0,
    Number(fee.month),
    Number(fee.year),
    Number(fee.due_day) || 1,
    settings,
    referenceDate
  )
}
