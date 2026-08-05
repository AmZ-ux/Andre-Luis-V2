import { config } from '../config'
import { realDashboard } from './realApi'
import type {
  DashboardData,
  ChartPeriod,
  ChartDataPoint,
} from '../types/dashboard'

const now = new Date()
const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function greeting(): string {
  const hour = now.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function timeAgo(date: Date): string {
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `Há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Há ${hours}h`
  const days = Math.floor(hours / 24)
  return `Há ${days}d`
}

const baseChartData: Record<ChartPeriod, ChartDataPoint[]> = {
  '7d': [
    { label: 'Seg', receita: 1850, pagamentos: 1620, inadimplencia: 180 },
    { label: 'Ter', receita: 2100, pagamentos: 1950, inadimplencia: 120 },
    { label: 'Qua', receita: 1780, pagamentos: 1450, inadimplencia: 240 },
    { label: 'Qui', receita: 2340, pagamentos: 2100, inadimplencia: 90 },
    { label: 'Sex', receita: 1980, pagamentos: 1800, inadimplencia: 150 },
    { label: 'Sáb', receita: 890, pagamentos: 890, inadimplencia: 0 },
    { label: 'Dom', receita: 450, pagamentos: 450, inadimplencia: 0 },
  ],
  '30d': [
    { label: 'Sem 1', receita: 12450, pagamentos: 11200, inadimplencia: 890 },
    { label: 'Sem 2', receita: 13800, pagamentos: 12500, inadimplencia: 720 },
    { label: 'Sem 3', receita: 11200, pagamentos: 9800, inadimplencia: 1100 },
    { label: 'Sem 4', receita: 14500, pagamentos: 13200, inadimplencia: 650 },
  ],
  '12m': [
    { label: 'Jan', receita: 42800, pagamentos: 39800, inadimplencia: 2100 },
    { label: 'Fev', receita: 39500, pagamentos: 37200, inadimplencia: 1800 },
    { label: 'Mar', receita: 45200, pagamentos: 42800, inadimplencia: 1600 },
    { label: 'Abr', receita: 41800, pagamentos: 39100, inadimplencia: 1900 },
    { label: 'Mai', receita: 47100, pagamentos: 44500, inadimplencia: 1500 },
    { label: 'Jun', receita: 48900, pagamentos: 46200, inadimplencia: 1700 },
    { label: 'Jul', receita: 51000, pagamentos: 48500, inadimplencia: 1400 },
  ],
}

function getDashboardData(): DashboardData {
  const month = monthNames[now.getMonth()]
  const expectedRevenue = 48200
  const receivedRevenue = 38450
  const pendingAmount = 6780
  const overdueAmount = 2970
  const receivedPercentage = Math.round((receivedRevenue / expectedRevenue) * 100)

  return {
    financialSummary: {
      expectedRevenue,
      receivedRevenue,
      pendingAmount,
      overdueAmount,
      receivedPercentage,
      month,
    },
    statistics: [
      {
        id: '1',
        title: 'Receita do Mês',
        value: `R$ ${receivedRevenue.toLocaleString('pt-BR')}`,
        description: `Esperado: R$ ${expectedRevenue.toLocaleString('pt-BR')}`,
        icon: 'DollarSign',
        change: 12,
        changeType: 'increase',
        color: 'primary',
      },
      {
        id: '2',
        title: 'Mensalidades Pagas',
        value: '187',
        description: 'De 220 mensalidades',
        icon: 'CheckCircle',
        change: 8,
        changeType: 'increase',
        color: 'success',
      },
      {
        id: '3',
        title: 'Mensalidades Pendentes',
        value: '22',
        description: 'Aguardando pagamento',
        icon: 'Clock',
        change: 3,
        changeType: 'increase',
        color: 'warning',
      },
      {
        id: '4',
        title: 'Mensalidades Atrasadas',
        value: '11',
        description: 'Com mais de 30 dias',
        icon: 'AlertTriangle',
        change: 5,
        changeType: 'decrease',
        color: 'error',
      },
      {
        id: '5',
        title: 'Passageiros Ativos',
        value: '152',
        description: 'Transportando atualmente',
        icon: 'Users',
        change: 10,
        changeType: 'increase',
        color: 'primary',
      },
      {
        id: '6',
        title: 'Passageiros em Férias',
        value: '8',
        description: 'Suspensão temporária',
        icon: 'Umbrella',
        change: 2,
        changeType: 'increase',
        color: 'warning',
      },
      {
        id: '7',
        title: 'Novos Passageiros',
        value: '14',
        description: 'Este mês',
        icon: 'UserPlus',
        change: 40,
        changeType: 'increase',
        color: 'success',
      },
      {
        id: '8',
        title: 'Total de Passageiros',
        value: '183',
        description: 'Cadastrados',
        icon: 'Users2',
        change: 8,
        changeType: 'increase',
        color: 'primary',
      },
    ],
    recentActivities: [
      { id: '1', person: 'João Silva', initials: 'JS', description: 'realizou pagamento da mensalidade', time: timeAgo(new Date(now.getTime() - 5 * 60000)), type: 'payment' },
      { id: '2', person: 'Maria Santos', initials: 'MS', description: 'enviou comprovante de pagamento', time: timeAgo(new Date(now.getTime() - 25 * 60000)), type: 'document' },
      { id: '3', person: 'Pedro Alves', initials: 'PA', description: 'solicitou férias por 15 dias', time: timeAgo(new Date(now.getTime() - 2 * 3600000)), type: 'vacation' },
      { id: '4', person: 'Carlos Lima', initials: 'CL', description: 'foi cadastrado no sistema', time: timeAgo(new Date(now.getTime() - 4 * 3600000)), type: 'register' },
      { id: '5', person: 'Ana Oliveira', initials: 'AO', description: 'realizou pagamento da mensalidade', time: timeAgo(new Date(now.getTime() - 6 * 3600000)), type: 'payment' },
      { id: '6', person: 'Lucas Costa', initials: 'LC', description: 'enviou comprovante de pagamento', time: timeAgo(new Date(now.getTime() - 8 * 3600000)), type: 'document' },
    ],
    upcomingPayments: [
      { id: '1', name: 'Fernanda Souza', initials: 'FS', dueDate: '28/07/2026', value: 180, daysRemaining: 3 },
      { id: '2', name: 'Roberto Lima', initials: 'RL', dueDate: '30/07/2026', value: 150, daysRemaining: 5 },
      { id: '3', name: 'Juliana Mendes', initials: 'JM', dueDate: '01/08/2026', value: 200, daysRemaining: 7 },
      { id: '4', name: 'Thiago Rocha', initials: 'TR', dueDate: '03/08/2026', value: 180, daysRemaining: 9 },
      { id: '5', name: 'Camila Barbosa', initials: 'CB', dueDate: '05/08/2026', value: 150, daysRemaining: 11 },
    ],
    notifications: [
      { id: '1', title: 'Pagamento recebido', message: 'João Silva pagou a mensalidade de Julho', time: timeAgo(new Date(now.getTime() - 10 * 60000)), type: 'payment', read: false },
      { id: '2', title: 'Mensalidade vencendo', message: 'Fernanda Souza vence em 3 dias', time: timeAgo(new Date(now.getTime() - 30 * 60000)), type: 'due', read: false },
      { id: '3', title: 'Comprovante enviado', message: 'Marina Santos enviou novo comprovante', time: timeAgo(new Date(now.getTime() - 2 * 3600000)), type: 'document', read: false },
      { id: '4', title: 'Mensalidade atrasada', message: 'Carlos Eduardo está com 15 dias de atraso', time: timeAgo(new Date(now.getTime() - 5 * 3600000)), type: 'due', read: true },
      { id: '5', title: 'Sistema atualizado', message: 'Nova versão disponível com melhorias', time: timeAgo(new Date(now.getTime() - 24 * 3600000)), type: 'system', read: true },
    ],
    chartData: baseChartData['30d'],
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const dashboardService = {
  async load(): Promise<DashboardData> {
    if (config.realApi) return realDashboard.get()
    await delay(600)
    return getDashboardData()
  },

  async getChartData(period: ChartPeriod): Promise<ChartDataPoint[]> {
    await delay(300)
    return baseChartData[period]
  },

  greeting,
}

export { greeting }
