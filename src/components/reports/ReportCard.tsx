import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import type { ReportCard as ReportCardType } from '../../types/reports'
import { DollarSign, Users, CalendarOff, FileCheck, BarChart3, TrendingUp, MapPin, School, Bus, CheckCircle, Clock, AlertTriangle, PieChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  DollarSign, BarChart3, TrendingUp, Users, CheckCircle, Clock, AlertTriangle,
  MapPin, School, Bus, CalendarOff, FileCheck, PieChart,
}

interface ReportCardItemProps {
  report: ReportCardType
  selected: boolean
  onClick: () => void
  index: number
}

export function ReportCardItem({ report, selected, onClick, index }: ReportCardItemProps) {
  const Icon = iconMap[report.icon] || BarChart3

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        padding
        hover
        className={`cursor-pointer transition-all duration-200 ${
          selected
            ? 'ring-2 ring-primary bg-primary/[0.02]'
            : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
        }`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">{report.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{report.description}</p>
          </div>
          {selected && (
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
              <CheckCircle className="h-3.5 w-3.5 text-white" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
