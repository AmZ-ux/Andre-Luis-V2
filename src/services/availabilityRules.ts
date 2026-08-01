import type { Availability } from '../types/availability'

export const availabilityRules = {
  canEdit(av: Availability): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = parseDate(av.startDate)
    return av.status === 'scheduled' && start > today
  },

  canCancel(av: Availability): boolean {
    return av.status === 'scheduled' || av.status === 'active'
  },

  isActive(av: Availability): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = parseDate(av.startDate)
    const end = parseDate(av.endDate)
    return av.status === 'scheduled' && start <= today && end >= today
  },

  getStatus(av: Availability): Availability['status'] {
    if (av.status === 'cancelled') return 'cancelled'
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = parseDate(av.startDate)
    const end = parseDate(av.endDate)

    if (start > today) return 'scheduled'
    if (start <= today && end >= today) return 'active'
    return 'finished'
  },

  calculateDays(startDate: string, endDate: string): number {
    const start = parseDate(startDate)
    const end = parseDate(endDate)
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  },

  isMonthContained(month: number, year: number, startDate: string, endDate: string): boolean {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const start = parseDate(startDate)
    const end = parseDate(endDate)

    const overlaps = start <= monthEnd && end >= monthStart

    return overlaps
  },
}

function parseDate(dateStr: string): Date {
  const [d, m, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(dateStr: string): string {
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
  }
  return dateStr
}

export function parseToInput(dateStr: string): string {
  if (dateStr.includes('-')) return dateStr
  const [d, m, y] = dateStr.split('/').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
