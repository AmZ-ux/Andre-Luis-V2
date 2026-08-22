import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card } from '../ui/Card'
import { SectionTitle } from './SectionTitle'
import type { ChartPeriod, ChartDataPoint } from '../../types/dashboard'
import { dashboardService } from '../../services/dashboardService'
import { cn } from '../../utils/cn'

const periods: { value: ChartPeriod; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '12m', label: '12 meses' },
]

const BAR_COLORS: Record<string, string> = {
  receita: '#1F4E5F',
  pagamentos: '#1E7A4E',
  inadimplencia: '#BE3128',
}

export function DashboardChart() {
  const [period, setPeriod] = useState<ChartPeriod>('30d')
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    dashboardService.getChartData(period).then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [period])

  return (
    <Card>
      <SectionTitle
        title="Visão financeira"
        subtitle="Receitas, pagamentos e inadimplência"
        action={
          <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  period === p.value
                    ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-text'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#8A8A85' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#8A8A85' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E2DFD8',
                  boxShadow: '0 2px 8px rgba(16,20,26,0.08)',
                  fontSize: 13,
                  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                }}
                formatter={(value: any) => [
                  `R$ ${Number(value ?? 0).toLocaleString('pt-BR')}`,
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-xs text-gray-500">{value}</span>
                )}
              />
              {Object.entries(BAR_COLORS).map(([key, color]) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key === 'receita' ? 'Receita' : key === 'pagamentos' ? 'Pagamentos' : 'Inadimplência'}
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}