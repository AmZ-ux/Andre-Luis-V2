import { Router } from 'express'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()
router.use(requireAdmin)

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function todayBR(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

router.get('/overview', (_req, res) => {
  const db = getDb()

  // ===== Financeiro =====
  const fees = db.prepare('SELECT * FROM monthly_fees').all() as any[]
  const payments = db.prepare('SELECT * FROM payments').all() as any[]

  const totalPrevisto = fees.reduce((s, f) => s + Number(f.amount || 0), 0)
  const totalRecebido = fees.filter((f) => f.status === 'paid').reduce((s, f) => s + Number(f.amount || 0), 0)
  const totalPendente = fees.filter((f) => f.status === 'pending').reduce((s, f) => s + Number(f.amount || 0), 0)
  const totalAtrasado = fees.filter((f) => f.status === 'overdue').reduce((s, f) => s + Number(f.amount || 0), 0)
  const inadimplencia = totalPrevisto > 0 ? (totalAtrasado / totalPrevisto) * 100 : 0
  const percentualRecebido = totalPrevisto > 0 ? (totalRecebido / totalPrevisto) * 100 : 0
  const totalPassageiros = new Set(fees.map((f) => f.passenger_id)).size
  const contratosAtivos = fees.filter((f) => f.status === 'pending' || f.status === 'paid').length

  const monthlyMap = new Map<string, { previsto: number; recebido: number; pendente: number; atrasado: number }>()
  for (let m = 1; m <= 12; m++) monthlyMap.set(String(m), { previsto: 0, recebido: 0, pendente: 0, atrasado: 0 })
  fees.forEach((f) => {
    const entry = monthlyMap.get(String(f.month))
    if (!entry) return
    entry.previsto += Number(f.amount || 0)
    if (f.status === 'paid') entry.recebido += Number(f.amount || 0)
    if (f.status === 'pending') entry.pendente += Number(f.amount || 0)
    if (f.status === 'overdue') entry.atrasado += Number(f.amount || 0)
  })
  const monthlyBreakdown = Array.from(monthlyMap.entries()).map(([m, d]) => ({
    month: MONTH_NAMES[Number(m) - 1],
    ...d,
  }))

  const methodMap = new Map<string, { total: number; count: number }>()
  payments.forEach((p) => {
    const key = p.payment_method || 'outros'
    if (!methodMap.has(key)) methodMap.set(key, { total: 0, count: 0 })
    const entry = methodMap.get(key)!
    entry.total += Number(p.amount || 0)
    entry.count++
  })
  const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, d]) => ({ method, ...d }))

  const statusMap = new Map<string, { total: number; count: number }>()
  fees.forEach((f) => {
    if (!statusMap.has(f.status)) statusMap.set(f.status, { total: 0, count: 0 })
    const entry = statusMap.get(f.status)!
    entry.total += Number(f.amount || 0)
    entry.count++
  })
  const statusBreakdown = Array.from(statusMap.entries()).map(([status, d]) => ({ status, ...d }))

  const financial = {
    totalPrevisto, totalRecebido, totalPendente, totalAtrasado,
    inadimplencia, percentualRecebido, totalPassageiros, contratosAtivos,
    totalMensalidades: fees.length,
    totalPagamentos: payments.length,
    monthlyBreakdown, paymentMethodBreakdown, statusBreakdown,
    fees,
  }

  // ===== Passageiros =====
  const passengers = db.prepare('SELECT * FROM passengers').all() as any[]
  const typeLabels: Record<string, string> = {
    university: 'Universitário', school: 'Escolar', contract: 'Contrato',
  }
  const groupBy = (field: string, labelField: string, skipEmpty: boolean) => {
    const map = new Map<string, number>()
    passengers.forEach((p) => {
      const key = p[labelField] || ''
      if (skipEmpty && !key) return
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ [field]: name, count }))
      .sort((a: any, b: any) => b.count - a.count)
  }

  const passengersData = {
    ativos: passengers.filter((p) => p.status === 'active').length,
    inativos: passengers.filter((p) => p.status === 'inactive').length,
    ferias: passengers.filter((p) => p.status === 'vacation').length,
    bloqueados: passengers.filter((p) => p.status === 'blocked').length,
    total: passengers.length,
    byCity: groupBy('name', 'city', true),
    byInstitution: groupBy('name', 'institution', true),
    byCompany: groupBy('name', 'company', true),
    byTransportType: (() => {
      const map = new Map<string, number>()
      passengers.forEach((p) => {
        const label = typeLabels[p.transport_type] || p.transport_type || 'outros'
        map.set(label, (map.get(label) || 0) + 1)
      })
      return Array.from(map.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
    })(),
    passengers,
  }

  // ===== Comprovantes =====
  const receipts = db.prepare('SELECT * FROM receipts').all() as any[]
  const statusLabels: Record<string, string> = {
    approved: 'Aprovados', rejected: 'Rejeitados', awaiting: 'Pendentes', cancelled: 'Cancelados',
  }
  const monthMap = new Map<string, number>()
  receipts.forEach((r) => {
    const key = `${MONTH_NAMES[Number(r.month) - 1]}/${r.year}`
    monthMap.set(key, (monthMap.get(key) || 0) + 1)
  })
  const byMonth = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))
  const receiptStatusMap = new Map<string, number>()
  receipts.forEach((r) => {
    const label = statusLabels[r.status] || r.status
    receiptStatusMap.set(label, (receiptStatusMap.get(label) || 0) + 1)
  })
  const byStatus = Array.from(receiptStatusMap.entries()).map(([status, count]) => ({ status, count }))

  const approvedReceipts = receipts.filter((r) => r.status === 'approved')
  let tempoMedioAprovacao = 'N/A'
  if (approvedReceipts.length > 0) {
    const diffs = approvedReceipts
      .map((r) => {
        const created = r.created_at ? new Date(r.created_at.replace(' ', 'T')).getTime() : 0
        const reviewed = r.review_date ? new Date(r.review_date.replace(' ', 'T')).getTime() : 0
        return reviewed > 0 && created > 0 ? reviewed - created : null
      })
      .filter((d): d is number => d !== null)
    if (diffs.length > 0) {
      const avgHours = diffs.reduce((s, d) => s + d, 0) / diffs.length / 3600000
      tempoMedioAprovacao = `${avgHours < 24 ? Math.max(1, Math.round(avgHours)) + 'h' : (avgHours / 24).toFixed(1) + 'd'}`
    }
  }

  const receiptsData = {
    aprovados: approvedReceipts.length,
    rejeitados: receipts.filter((r) => r.status === 'rejected').length,
    pendentes: receipts.filter((r) => r.status === 'awaiting').length,
    cancelados: receipts.filter((r) => r.status === 'cancelled').length,
    total: receipts.length,
    tempoMedioAprovacao,
    byStatus,
    byMonth,
    receipts,
  }

  // ===== Disponibilidade =====
  const availabilities = db.prepare('SELECT * FROM availabilities').all() as any[]
  const today = todayBR()
  const activeAv = availabilities.filter((a) => a.status !== 'cancelled' && a.start_date <= today && a.end_date >= today)
  const avMonthMap = new Map<string, number>()
  availabilities.filter((a) => a.status !== 'cancelled').forEach((a) => {
    const month = Number(String(a.start_date || '').split('/')[1])
    const key = MONTH_NAMES[month - 1]
    if (key) avMonthMap.set(key, (avMonthMap.get(key) || 0) + 1)
  })
  const byMonthAv = Array.from(avMonthMap.entries()).map(([month, count]) => ({ month, count }))

  const availabilityData = {
    active: activeAv.length,
    scheduled: availabilities.filter((a) => a.status !== 'cancelled' && a.start_date > today).length,
    finished: availabilities.filter((a) => a.status === 'finished' || (a.status !== 'cancelled' && a.end_date < today)).length,
    cancelled: availabilities.filter((a) => a.status === 'cancelled').length,
    total: availabilities.length,
    returningToday: availabilities.filter((a) => a.end_date === today && a.status !== 'cancelled').length,
    byMonth: byMonthAv,
  }

  res.json({
    financial,
    passengers: passengersData,
    receipts: receiptsData,
    availability: availabilityData,
  })
})

export default router
