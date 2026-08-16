import { OVERLAP_CONFIG } from '../types/availability'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export const availabilityValidation = {
  validateDates(startDate: string, endDate: string): ValidationResult {
    if (!startDate) return { valid: false, error: 'Data inicial é obrigatória' }
    if (!endDate) return { valid: false, error: 'Data final é obrigatória' }

    const start = parseDateBR(startDate)
    const end = parseDateBR(endDate)

    if (!start || isNaN(start.getTime())) return { valid: false, error: 'Data inicial inválida' }
    if (!end || isNaN(end.getTime())) return { valid: false, error: 'Data final inválida' }

    if (end < start) return { valid: false, error: 'Data final deve ser maior que a data inicial' }

    if (!OVERLAP_CONFIG.allowPastDates) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (start < today) return { valid: false, error: 'Não é permitido criar períodos retroativos' }
    }

    return { valid: true }
  },

  validateReason(reason: string): ValidationResult {
    if (!reason.trim()) return { valid: false, error: 'Motivo é obrigatório' }
    if (reason.trim().length < 3) return { valid: false, error: 'Motivo deve ter pelo menos 3 caracteres' }
    return { valid: true }
  },

  validateNoOverlap(
    startDate: string,
    endDate: string,
    existing: { startDate: string; endDate: string; id: string }[],
    excludeId?: string
  ): ValidationResult {
    const newStart = new Date(startDate)
    const newEnd = new Date(endDate)

    for (const period of existing) {
      if (excludeId && period.id === excludeId) continue
      const existStart = parseDateBR(period.startDate)
      const existEnd = parseDateBR(period.endDate)

      if (newStart <= existEnd && newEnd >= existStart) {
        return {
          valid: false,
          error: 'Período sobreposto com outro já cadastrado',
        }
      }
    }

    return { valid: true }
  },
}

function parseDateBR(dateStr: string): Date {
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const [d, m, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d)
}
