import type { FinancialSummary } from '../types/reports'
import type { MonthlyFee } from '../types/monthlyFee'

function loadFees(): MonthlyFee[] {
  const stored = localStorage.getItem('mock_monthly_fees')
  return stored ? JSON.parse(stored) : []
}

function loadPayments() {
  const stored = localStorage.getItem('mock_payments')
  return stored ? JSON.parse(stored) : []
}

export const financialAnalytics = {
  async getSummary(): Promise<FinancialSummary> {
    const fees = loadFees()
    const payments = loadPayments()

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    const totalPrevisto = fees.reduce((s, f) => s + f.amount, 0)
    const paidFees = fees.filter((f) => f.status === 'paid')
    const totalRecebido = paidFees.reduce((s, f) => s + f.amount, 0)
    const totalPendente = fees.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0)
    const totalAtrasado = fees.filter((f) => f.status === 'overdue').reduce((s, f) => s + f.amount, 0)

    const totalPassageiros = new Set(fees.map((f) => f.passengerId)).size
    const contratosAtivos = fees.filter((f) => f.status === 'pending' || f.status === 'paid').length
    const inadimplencia = totalPrevisto > 0 ? (totalAtrasado / totalPrevisto) * 100 : 0
    const percentualRecebido = totalPrevisto > 0 ? (totalRecebido / totalPrevisto) * 100 : 0

    const monthsMap = new Map<string, { previsto: number; recebido: number; pendente: number; atrasado: number }>()
    for (let m = 1; m <= 12; m++) {
      monthsMap.set(String(m), { previsto: 0, recebido: 0, pendente: 0, atrasado: 0 })
    }
    fees.forEach((f) => {
      const key = String(f.month)
      const entry = monthsMap.get(key)!
      entry.previsto += f.amount
      if (f.status === 'paid') entry.recebido += f.amount
      if (f.status === 'pending') entry.pendente += f.amount
      if (f.status === 'overdue') entry.atrasado += f.amount
    })

    const monthlyBreakdown = Array.from(monthsMap.entries()).map(([m, d]) => ({
      month: monthNames[parseInt(m) - 1],
      ...d,
    }))

    const methodMap = new Map<string, { total: number; count: number }>()
    payments.forEach((p: { paymentMethod: string; amount: number }) => {
      const m = p.paymentMethod
      if (!methodMap.has(m)) methodMap.set(m, { total: 0, count: 0 })
      const entry = methodMap.get(m)!
      entry.total += p.amount
      entry.count++
    })
    const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, d]) => ({ method, ...d }))

    const statusMap = new Map<string, { total: number; count: number }>()
    fees.forEach((f) => {
      if (!statusMap.has(f.status)) statusMap.set(f.status, { total: 0, count: 0 })
      const entry = statusMap.get(f.status)!
      entry.total += f.amount
      entry.count++
    })
    const statusBreakdown = Array.from(statusMap.entries()).map(([status, d]) => ({ status, ...d }))

    return {
      totalPrevisto, totalRecebido, totalPendente, totalAtrasado,
      inadimplencia, percentualRecebido, totalPassageiros, contratosAtivos,
      totalMensalidades: fees.length,
      totalPagamentos: payments.length,
      monthlyBreakdown, paymentMethodBreakdown, statusBreakdown,
    }
  },

  async generateReport(
    type: 'monthly' | 'annual' | 'period' | 'flow' | 'paid' | 'pending' | 'overdue' | 'cancelled' | 'exempt'
  ): Promise<{ title: string; chartData: Record<string, unknown>[]; tableData: Record<string, unknown>[] }> {
    const summary = await this.getSummary()

    if (type === 'monthly') {
      return {
        title: 'Receita Mensal',
        chartData: summary.monthlyBreakdown,
        tableData: summary.monthlyBreakdown,
      }
    }

    if (type === 'paid' || type === 'pending' || type === 'overdue' || type === 'cancelled' || type === 'exempt') {
      const statusMap: Record<string, string> = {
        paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado', exempt: 'Isento',
      }
      const statusKey = type === 'paid' ? 'paid' : type === 'pending' ? 'pending' : type === 'overdue' ? 'overdue' : type === 'cancelled' ? 'cancelled' : 'exempt'
      const fees = loadFees().filter((f) => f.status === statusKey)
      return {
        title: `Mensalidades ${statusMap[statusKey]}`,
        chartData: summary.monthlyBreakdown.map((m) => ({ month: m.month, valor: statusKey === 'paid' ? m.recebido : statusKey === 'pending' ? m.pendente : statusKey === 'overdue' ? m.atrasado : 0 })),
        tableData: fees.map((f) => ({
          passageiro: f.passengerName,
          competencia: `${String(f.month).padStart(2, '0')}/${f.year}`,
          valor: f.amount,
          vencimento: f.dueDate,
          observacao: f.notes || '-',
        })),
      }
    }

    return {
      title: 'Fluxo de Recebimentos',
      chartData: summary.monthlyBreakdown,
      tableData: summary.monthlyBreakdown,
    }
  },
}
