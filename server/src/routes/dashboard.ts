import { Router } from 'express'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

router.use(requireAdmin)

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function toIsoDate(v: string): string {
  if (!v) return ''
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return v.slice(0, 10)
}

interface ChartBucket {
  key: string
  label: string
  start: string
  end: string
}

function buildChartData(db: any, period: string) {
  const now = new Date()

  const paidRows = db.prepare(`
    SELECT p.payment_date as date, p.amount, mf.month, mf.year
    FROM payments p
    JOIN monthly_fees mf ON mf.id = p.monthly_fee_id
  `).all() as any[]

  const overdueRows = db.prepare(`
    SELECT month, year, due_date, amount FROM monthly_fees WHERE status = 'overdue'
  `).all() as any[]

  if (period === '12m') {
    const year = now.getFullYear()
    const paidByMonth: Record<number, { count: number; total: number }> = {}
    for (const r of paidRows) {
      if (r.year !== year) continue
      const p = paidByMonth[r.month] || (paidByMonth[r.month] = { count: 0, total: 0 })
      p.count += 1
      p.total += r.amount
    }
    const overdueByMonth: Record<number, number> = {}
    for (const r of overdueRows) {
      if (r.year !== year) continue
      overdueByMonth[r.month] = (overdueByMonth[r.month] || 0) + r.amount
    }
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const paid = paidByMonth[m] || { count: 0, total: 0 }
      return {
        label: monthNames[i].slice(0, 3),
        receita: round2(paid.total),
        pagamentos: paid.count,
        inadimplencia: round2(overdueByMonth[m] || 0),
      }
    })
  }

  const days = period === '7d' ? 7 : 28
  const step = period === '7d' ? 1 : 7
  const buckets: ChartBucket[] = []
  for (let i = days - step; i >= 0; i -= step) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setDate(end.getDate() + step - 1)
    buckets.push({
      key: period === '7d' ? d.toISOString().slice(0, 10) : `w${(days - i) / step}`,
      label: period === '7d' ? weekDays[d.getDay()] : `Sem ${(days - i) / step}`,
      start: d.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    })
  }

  const paid: Record<string, { count: number; total: number }> = {}
  const over: Record<string, number> = {}
  for (const b of buckets) {
    paid[b.key] = { count: 0, total: 0 }
    over[b.key] = 0
  }

  for (const r of paidRows) {
    const iso = toIsoDate(r.date)
    if (!iso) continue
    const b = buckets.find((x) => iso >= x.start && iso <= x.end)
    if (!b) continue
    const p = paid[b.key]
    p.count += 1
    p.total += r.amount
  }
  for (const r of overdueRows) {
    const iso = toIsoDate(r.due_date)
    if (!iso) continue
    const b = buckets.find((x) => iso >= x.start && iso <= x.end)
    if (!b) continue
    over[b.key] += r.amount
  }

  return buckets.map((b) => ({
    label: b.label,
    receita: round2(paid[b.key].total),
    pagamentos: paid[b.key].count,
    inadimplencia: round2(over[b.key]),
  }))
}

router.get('/', (_req, res) => {
  const db = getDb()

  const totalPassengers = (db.prepare('SELECT COUNT(*) as c FROM passengers').get() as any).c
  const activePassengers = (db.prepare("SELECT COUNT(*) as c FROM passengers WHERE status = 'active'").get() as any).c
  const pendingFees = (db.prepare("SELECT COUNT(*) as c FROM monthly_fees WHERE status IN ('pending', 'overdue')").get() as any).c
  const overdueFees = (db.prepare("SELECT COUNT(*) as c FROM monthly_fees WHERE status = 'overdue'").get() as any).c
  const paidThisMonthCount = (db.prepare("SELECT COUNT(*) as c FROM monthly_fees WHERE status = 'paid' AND month = ? AND year = ?").get(new Date().getMonth() + 1, new Date().getFullYear()) as any).c
  const paidThisMonth = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_fees WHERE status = 'paid' AND month = ? AND year = ?").get(new Date().getMonth() + 1, new Date().getFullYear()) as any).total
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_fees WHERE status = 'paid'").get() as any).total
  const expectedRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_fees").get() as any).total
  const pendingRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_fees WHERE status IN ('pending', 'overdue')").get() as any).total
  const awaitingReceipts = (db.prepare("SELECT COUNT(*) as c FROM receipts WHERE status = 'awaiting'").get() as any).c
  const av = db.prepare("SELECT COUNT(*) as c FROM availabilities WHERE status = 'active'").get() as any

  const receivedPercentage = expectedRevenue > 0 ? Math.round((totalRevenue / expectedRevenue) * 100) : 0

  // Recent activity
  const recentPayments = db.prepare(`
    SELECT mf.id, mf.passenger_name as person, mf.amount, mf.updated_at
    FROM monthly_fees mf WHERE mf.status = 'paid'
    ORDER BY mf.updated_at DESC LIMIT 10
  `).all() as any[]

  const recentReceipts = db.prepare(`
    SELECT r.id, r.passenger_name as person, r.updated_at
    FROM receipts r WHERE r.status IN ('approved', 'rejected')
    ORDER BY r.updated_at DESC LIMIT 5
  `).all() as any[]

  const recentAvailabilities = db.prepare(`
    SELECT a.id, a.passenger_name as person, a.updated_at
    FROM availabilities a WHERE a.updated_at IS NOT NULL
    ORDER BY a.updated_at DESC LIMIT 5
  `).all() as any[]

  const allActivities: any[] = []
  for (const p of recentPayments) {
    allActivities.push({ id: `act-pay-${p.id}`, person: p.person, initials: initials(p.person), description: `Pagamento de R$ ${Number(p.amount).toFixed(2)}`, time: p.updated_at || '', type: 'payment' })
  }
  for (const r of recentReceipts) {
    allActivities.push({ id: `act-rec-${r.id}`, person: r.person, initials: initials(r.person), description: 'Comprovante atualizado', time: r.updated_at || '', type: 'document' })
  }
  for (const a of recentAvailabilities) {
    allActivities.push({ id: `act-av-${a.id}`, person: a.person, initials: initials(a.person), description: 'Disponibilidade atualizada', time: a.updated_at || '', type: 'vacation' })
  }
  allActivities.sort((a: any, b: any) => b.time.localeCompare(a.time)).slice(0, 10)

  // Upcoming payments
  const rawUpcoming = db.prepare(`
    SELECT mf.*, p.name as passenger_name FROM monthly_fees mf
    JOIN passengers p ON p.id = mf.passenger_id
    WHERE mf.status IN ('pending', 'overdue')
    ORDER BY mf.due_day ASC LIMIT 5
  `).all() as any[]

  const now = new Date()
  const today = now.getDate()
  const upcomingPayments = rawUpcoming.map((fee: any) => ({
    id: fee.id,
    name: fee.passenger_name,
    initials: initials(fee.passenger_name),
    dueDate: `${String(fee.due_day).padStart(2, '0')}/${String(fee.month).padStart(2, '0')}`,
    value: fee.amount,
    daysRemaining: fee.due_day - today,
  }))

  // Notifications
  const rawNotifs = db.prepare(`
    SELECT * FROM notifications WHERE status = 'unread'
    ORDER BY created_at DESC LIMIT 5
  `).all() as any[]

  const notifications = rawNotifs.map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    time: n.created_at || '',
    type: n.type || 'system',
    read: n.status !== 'unread',
  }))

  // Monthly chart data
  const chartData = buildChartData(db, '12m')

  res.json({
    financialSummary: {
      expectedRevenue,
      receivedRevenue: totalRevenue,
      pendingAmount: pendingRevenue,
      overdueAmount: (db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM monthly_fees WHERE status = 'overdue'").get() as any).total,
      receivedPercentage,
      month: monthNames[now.getMonth()],
    },
    statistics: [
      { id: '1', title: 'Passageiros Ativos', value: String(activePassengers), description: `de ${totalPassengers} total`, icon: 'Users', change: 0, changeType: 'increase', color: 'primary' },
      { id: '2', title: 'Mensalidades Pendentes', value: String(pendingFees), description: `${overdueFees} vencidas`, icon: 'DollarSign', change: 0, changeType: 'decrease', color: 'warning' },
      { id: '3', title: 'Receita do Mês', value: `R$ ${Number(paidThisMonth).toFixed(2)}`, description: `${paidThisMonthCount} mensalidades pagas`, icon: 'TrendingUp', change: 0, changeType: 'increase', color: 'success' },
      { id: '4', title: 'Comprovantes Pendentes', value: String(awaitingReceipts), description: 'aguardando revisão', icon: 'FileText', change: 0, changeType: 'increase', color: 'error' },
      { id: '5', title: 'Em Férias', value: String(av.c), description: 'atualmente', icon: 'Plane', change: 0, changeType: 'increase', color: 'info' },
      { id: '6', title: 'Taxa de Adimplência', value: `${receivedPercentage}%`, description: 'geral', icon: 'CheckCircle', change: 0, changeType: 'increase', color: 'success' },
      { id: '7', title: 'Receita Prevista', value: `R$ ${expectedRevenue.toFixed(2)}`, description: 'total esperado', icon: 'Calendar', change: 0, changeType: 'increase', color: 'primary' },
      { id: '8', title: 'Receita Realizada', value: `R$ ${totalRevenue.toFixed(2)}`, description: 'total recebido', icon: 'BarChart3', change: 0, changeType: 'increase', color: 'success' },
    ],
    recentActivities: allActivities.slice(0, 10),
    upcomingPayments,
    notifications,
    chartData,
  })
})

router.get('/chart', (_req, res) => {
  const db = getDb()
  const period = (_req.query.period as string) || '12m'
  if (!['7d', '30d', '12m'].includes(period)) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }
  res.json(buildChartData(db, period))
})

export default router
