import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card>
        <SectionTitle
          title="Visão Financeira"
          subtitle="Acompanhamento de receitas e inadimplência"
          action={
            <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {periods.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-all duration-200',
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: 13,
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
                <Bar
                  dataKey="receita"
                  name="Receita"
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="pagamentos"
                  name="Pagamentos"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="inadimplencia"
                  name="Inadimplência"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </motion.div>
  )
}
