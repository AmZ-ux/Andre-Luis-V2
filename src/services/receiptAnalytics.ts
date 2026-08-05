import { config } from '../config'
import { realReports } from './realApi'
import type { ReceiptReportData } from '../types/reports'
import type { Receipt } from '../types/receipt'

function loadReceipts(): Receipt[] {
  const stored = localStorage.getItem('mock_receipts')
  return stored ? JSON.parse(stored) : []
}

export const receiptAnalytics = {
  async getReportData(): Promise<ReceiptReportData> {
    if (config.realApi) {
      const overview = await realReports.overview()
      const r = overview.receipts
      return {
        aprovados: r.aprovados,
        rejeitados: r.rejeitados,
        pendentes: r.pendentes,
        cancelados: r.cancelados,
        total: r.total,
        tempoMedioAprovacao: r.tempoMedioAprovacao,
        byStatus: r.byStatus,
        byMonth: r.byMonth,
      }
    }

    const receipts = loadReceipts()

    const aprovados = receipts.filter((r) => r.status === 'approved').length
    const rejeitados = receipts.filter((r) => r.status === 'rejected').length
    const pendentes = receipts.filter((r) => r.status === 'awaiting').length
    const cancelados = receipts.filter((r) => r.status === 'cancelled').length

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const monthMap = new Map<string, number>()
    receipts.forEach((r) => {
      const key = `${monthNames[r.month - 1]}/${r.year}`
      monthMap.set(key, (monthMap.get(key) || 0) + 1)
    })
    const byMonth = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }))

    const statusMap = new Map<string, number>()
    const statusLabels: Record<string, string> = {
      approved: 'Aprovados', rejected: 'Rejeitados', awaiting: 'Pendentes', cancelled: 'Cancelados',
    }
    receipts.forEach((r) => {
      const label = statusLabels[r.status] || r.status
      statusMap.set(label, (statusMap.get(label) || 0) + 1)
    })
    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

    const approvedReceipts = receipts.filter((r) => r.status === 'approved')
    const tempoMedioAprovacao = approvedReceipts.length > 0
      ? `${Math.floor(Math.random() * 24 + 1)}h` : 'N/A'

    return {
      aprovados, rejeitados, pendentes, cancelados,
      total: receipts.length,
      tempoMedioAprovacao,
      byStatus, byMonth,
    }
  },

  async generateReport(type: 'approved' | 'rejected' | 'pending'): Promise<{
    title: string
    chartData: Record<string, unknown>[]
    tableData: Record<string, unknown>[]
  }> {
    if (config.realApi) {
      const overview = await realReports.overview()
      const data = overview.receipts
      const statusMap: Record<string, string> = {
        approved: 'approved', rejected: 'rejected', pending: 'awaiting',
      }
      const titleMap: Record<string, string> = {
        approved: 'Comprovantes Aprovados',
        rejected: 'Comprovantes Rejeitados',
        pending: 'Comprovantes Pendentes',
      }
      const list: any[] = data.receipts || []
      const filtered = list.filter((r) => r.status === statusMap[type])
      return {
        title: titleMap[type],
        chartData: data.byMonth,
        tableData: filtered.map((r) => ({
          passageiro: r.passengerName,
          competencia: `${String(r.month).padStart(2, '0')}/${r.year}`,
          valor: r.amount,
          arquivo: r.fileName,
          envio: r.createdAt,
        })),
      }
    }

    const data = await this.getReportData()
    const receipts = loadReceipts()

    const statusMap: Record<string, string> = {
      approved: 'approved', rejected: 'rejected', pending: 'awaiting',
    }
    const titleMap: Record<string, string> = {
      approved: 'Comprovantes Aprovados',
      rejected: 'Comprovantes Rejeitados',
      pending: 'Comprovantes Pendentes',
    }

    const filtered = receipts.filter((r) => r.status === statusMap[type])

    return {
      title: titleMap[type],
      chartData: data.byMonth,
      tableData: filtered.map((r) => ({
        passageiro: r.passengerName,
        competencia: `${String(r.month).padStart(2, '0')}/${r.year}`,
        valor: r.amount,
        arquivo: r.fileName,
        envio: r.createdAt,
      })),
    }
  },
}
