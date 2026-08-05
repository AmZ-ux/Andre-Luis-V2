import { Router } from 'express'
import { getDb } from '../database/connection.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

router.use(requireAdmin)

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

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
  const monthlyRevenue = db.prepare(`
    SELECT month, year, COALESCE(SUM(amount), 0) as total FROM monthly_fees
    WHERE status = 'paid' AND year = ? GROUP BY month ORDER BY month
  `).all(new Date().getFullYear()) as any[]

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = monthlyRevenue.find((r: any) => r.month === i + 1)
    return {
      label: monthNames[i].slice(0, 3),
      receita: m ? m.total : 0,
      pagamentos: 0,
      inadimplencia: 0,
    }
  })

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

export default router
