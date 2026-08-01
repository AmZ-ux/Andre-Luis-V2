import { useState, useEffect, useCallback } from 'react'
import { financialAnalytics } from '../services/financialAnalytics'
import { passengerAnalytics } from '../services/passengerAnalytics'
import { receiptAnalytics } from '../services/receiptAnalytics'
import { availabilityAnalytics } from '../services/availabilityAnalytics'
import type {
  ReportCard,
  ReportFilters,
  ReportData,
  FinancialSummary,
  PassengerReportData,
  ReceiptReportData,
  AvailabilityReportData,
} from '../types/reports'

const defaultFilters: ReportFilters = {
  period: 'year',
  month: '',
  year: String(new Date().getFullYear()),
  startDate: '',
  endDate: '',
  city: '',
  institution: '',
  company: '',
  transportType: '',
  passenger: '',
  status: '',
  paymentMethod: '',
}

const reportCards: ReportCard[] = [
  { id: 'financial-overview', title: 'Visão Geral Financeira', description: 'Indicadores financeiros consolidados', category: 'financial', icon: 'DollarSign', available: true },
  { id: 'monthly-revenue', title: 'Receita Mensal', description: 'Receita mensal detalhada', category: 'financial', icon: 'BarChart3', available: true },
  { id: 'paid-fees', title: 'Mensalidades Pagas', description: 'Todas as mensalidades pagas', category: 'financial', icon: 'CheckCircle', available: true },
  { id: 'pending-fees', title: 'Mensalidades Pendentes', description: 'Mensalidades em aberto', category: 'financial', icon: 'Clock', available: true },
  { id: 'overdue-fees', title: 'Mensalidades Atrasadas', description: 'Mensalidades vencidas', category: 'financial', icon: 'AlertTriangle', available: true },
  { id: 'flow', title: 'Fluxo de Recebimentos', description: 'Fluxo mensal de recebimentos', category: 'financial', icon: 'TrendingUp', available: true },
  { id: 'passengers-active', title: 'Passageiros Ativos', description: 'Lista de passageiros ativos', category: 'passengers', icon: 'Users', available: true },
  { id: 'passengers-by-city', title: 'Por Cidade', description: 'Passageiros agrupados por cidade', category: 'passengers', icon: 'MapPin', available: true },
  { id: 'passengers-by-institution', title: 'Por Instituição', description: 'Passageiros por instituição de ensino', category: 'passengers', icon: 'School', available: true },
  { id: 'passengers-by-type', title: 'Por Tipo de Transporte', description: 'Distribuição por tipo de transporte', category: 'passengers', icon: 'Bus', available: true },
  { id: 'availability-overview', title: 'Períodos de Ausência', description: 'Visão geral de disponibilidade', category: 'availability', icon: 'CalendarOff', available: true },
  { id: 'receipts-overview', title: 'Comprovantes', description: 'Análise de comprovantes', category: 'receipts', icon: 'FileCheck', available: true },
]

export function useReports() {
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null)
  const [passengerData, setPassengerData] = useState<PassengerReportData | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptReportData | null>(null)
  const [availabilityData, setAvailabilityData] = useState<AvailabilityReportData | null>(null)
  const [search, setSearch] = useState('')

  const loadAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [fin, pass, rec, av] = await Promise.all([
        financialAnalytics.getSummary(),
        passengerAnalytics.getReportData(),
        receiptAnalytics.getReportData(),
        availabilityAnalytics.getReportData(),
      ])
      setFinancialSummary(fin)
      setPassengerData(pass)
      setReceiptData(rec)
      setAvailabilityData(av)
    } catch {
      setError('Erro ao carregar dados dos relatórios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const clearReport = useCallback(() => {
    setActiveReport(null)
    setReportData(null)
  }, [])

  const generateReport = useCallback(async (reportId: string) => {
    setActiveReport(reportId)
    setLoading(true)
    setError(null)
    try {
      let data: ReportData | null = null

      switch (reportId) {
        case 'financial-overview': {
          const s = await financialAnalytics.getSummary()
          data = {
            title: 'Visão Geral Financeira',
            indicators: [
              { label: 'Receita Prevista', value: `R$ ${s.totalPrevisto.toFixed(2).replace('.', ',')}` },
              { label: 'Receita Recebida', value: `R$ ${s.totalRecebido.toFixed(2).replace('.', ',')}` },
              { label: 'Valor Pendente', value: `R$ ${s.totalPendente.toFixed(2).replace('.', ',')}` },
              { label: 'Valor Atrasado', value: `R$ ${s.totalAtrasado.toFixed(2).replace('.', ',')}` },
              { label: 'Taxa de Inadimplência', value: `${s.inadimplencia.toFixed(1)}%`, changeType: s.inadimplencia > 20 ? 'negative' : 'positive' },
              { label: 'Percentual Recebido', value: `${s.percentualRecebido.toFixed(1)}%`, changeType: s.percentualRecebido > 70 ? 'positive' : 'negative' },
              { label: 'Total de Passageiros', value: String(s.totalPassageiros) },
              { label: 'Mensalidades Geradas', value: String(s.totalMensalidades) },
              { label: 'Total de Pagamentos', value: String(s.totalPagamentos) },
            ],
            chartData: s.monthlyBreakdown,
            tableColumns: [
              { key: 'month', label: 'Mês' },
              { key: 'previsto', label: 'Previsto', align: 'right' },
              { key: 'recebido', label: 'Recebido', align: 'right' },
              { key: 'pendente', label: 'Pendente', align: 'right' },
              { key: 'atrasado', label: 'Atrasado', align: 'right' },
            ],
            tableData: s.monthlyBreakdown,
          }
          break
        }
        case 'paid-fees':
        case 'pending-fees':
        case 'overdue-fees':
        case 'cancelled-fees': {
          const type = reportId.replace('-fees', '') as 'paid' | 'pending' | 'overdue' | 'cancelled'
          const result = await financialAnalytics.generateReport(type)
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'passageiro', label: 'Passageiro' },
              { key: 'competencia', label: 'Competência', align: 'center' },
              { key: 'valor', label: 'Valor', align: 'right' },
              { key: 'vencimento', label: 'Vencimento', align: 'center' },
              { key: 'observacao', label: 'Observação' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'monthly-revenue':
        case 'flow': {
          const result = await financialAnalytics.generateReport('monthly')
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'month', label: 'Mês' },
              { key: 'previsto', label: 'Previsto', align: 'right' },
              { key: 'recebido', label: 'Recebido', align: 'right' },
              { key: 'pendente', label: 'Pendente', align: 'right' },
              { key: 'atrasado', label: 'Atrasado', align: 'right' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'passengers-active': {
          const result = await passengerAnalytics.generateReport('active')
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'nome', label: 'Nome' },
              { key: 'cpf', label: 'CPF' },
              { key: 'cidade', label: 'Cidade' },
              { key: 'tipo', label: 'Tipo' },
              { key: 'instituicao', label: 'Instituição' },
              { key: 'empresa', label: 'Empresa' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'passengers-by-city': {
          const result = await passengerAnalytics.generateReport('city')
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'name', label: 'Cidade' },
              { key: 'count', label: 'Quantidade', align: 'right' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'passengers-by-institution': {
          const result = await passengerAnalytics.generateReport('institution')
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'name', label: 'Instituição' },
              { key: 'count', label: 'Quantidade', align: 'right' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'passengers-by-type': {
          const result = await passengerAnalytics.generateReport('transportType')
          data = {
            title: result.title,
            indicators: [],
            chartData: result.chartData,
            tableColumns: [
              { key: 'type', label: 'Tipo' },
              { key: 'count', label: 'Quantidade', align: 'right' },
            ],
            tableData: result.tableData,
          }
          break
        }
        case 'availability-overview': {
          const av = await availabilityAnalytics.getReportData()
          data = {
            title: 'Períodos de Ausência',
            indicators: [
              { label: 'Em andamento', value: String(av.active) },
              { label: 'Agendados', value: String(av.scheduled) },
              { label: 'Finalizados', value: String(av.finished) },
              { label: 'Cancelados', value: String(av.cancelled) },
              { label: 'Retornam hoje', value: String(av.returningToday) },
            ],
            chartData: av.byMonth,
            tableColumns: [
              { key: 'month', label: 'Mês' },
              { key: 'count', label: 'Quantidade', align: 'right' },
            ],
            tableData: av.byMonth,
          }
          break
        }
        case 'receipts-overview': {
          const r = await receiptAnalytics.getReportData()
          data = {
            title: 'Análise de Comprovantes',
            indicators: [
              { label: 'Aprovados', value: String(r.aprovados) },
              { label: 'Rejeitados', value: String(r.rejeitados) },
              { label: 'Pendentes', value: String(r.pendentes) },
              { label: 'Cancelados', value: String(r.cancelados) },
              { label: 'Tempo médio', value: r.tempoMedioAprovacao },
            ],
            chartData: r.byStatus,
            tableColumns: [
              { key: 'status', label: 'Status' },
              { key: 'count', label: 'Quantidade', align: 'right' },
            ],
            tableData: r.byStatus,
          }
          break
        }
      }

      setReportData(data)
    } catch {
      setError('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }, [])

  const filteredReports = search
    ? reportCards.filter(
        (r) =>
          r.title.toLowerCase().includes(search.toLowerCase()) ||
          r.description.toLowerCase().includes(search.toLowerCase())
      )
    : reportCards

  return {
    reportCards: filteredReports,
    activeReport,
    loading,
    error,
    filters,
    financialSummary,
    passengerData,
    receiptData,
    availabilityData,
    reportData,
    search,
    setSearch,
    updateFilters: setFilters,
    resetFilters: () => setFilters(defaultFilters),
    generateReport,
    clearReport,
    reload: loadAllData,
  }
}
