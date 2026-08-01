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

export function buildDueDate(year: number, month: number, dueDay: number): Date {
  return new Date(year, month - 1, dueDay)
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
