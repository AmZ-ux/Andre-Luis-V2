import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import type { ChartType } from '../../types/reports'
import type { PieLabelRenderProps } from 'recharts'

const COLORS = ['#2563EB', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
const RADIAN = Math.PI / 180

function renderCustomizedLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) {
  const radius = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5
  const x = Number(cx) + radius * Math.cos(Number(midAngle) * RADIAN)
  const y = Number(cy) + radius * Math.sin(Number(midAngle) * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${((percent ?? 0) * 100).toFixed(0)}%`}
    </text>
  )
}

interface ReportChartsProps {
  data: Record<string, unknown>[]
  chartType: ChartType
  dataKeys?: string[]
  loading?: boolean
}

export function ReportCharts({ data, chartType, dataKeys, loading }: ReportChartsProps) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        Nenhum dado disponível para exibição
      </div>
    )
  }

  const keys = dataKeys || Object.keys(data[0]).filter((k) => k !== 'month' && k !== 'name' && k !== 'type' && k !== 'status')

  const commonTooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: 13,
  }

  switch (chartType) {
    case 'line':
      return (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={commonTooltipStyle} />
              <Legend iconType="circle" iconSize={8} />
              {keys.map((key, i) => (
                <Line
                  key={key}
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )

    case 'pie':
    case 'donut':
      return (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? 50 : 0}
                outerRadius={100}
                label={renderCustomizedLabel}
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={commonTooltipStyle} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span className="text-xs text-gray-500">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )

    case 'area':
      return (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={commonTooltipStyle} />
              <Legend iconType="circle" iconSize={8} />
              {keys.map((key, i) => (
                <Area
                  key={key}
                  dataKey={key}
                  fill={COLORS[i % COLORS.length]}
                  stroke={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )

    default:
      return (
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={commonTooltipStyle} />
              <Legend iconType="circle" iconSize={8} />
              {keys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[i % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
  }
}
