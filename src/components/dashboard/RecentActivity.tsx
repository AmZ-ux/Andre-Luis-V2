import { motion } from 'framer-motion'
import { Card } from '../ui/Card'
import { SectionTitle } from './SectionTitle'
import { Button } from '../ui/Button'
import type { Activity } from '../../types/dashboard'
import { DollarSign, FileText, Umbrella, UserPlus } from 'lucide-react'
import { cn } from '../../utils/cn'

interface RecentActivityProps {
  activities: Activity[]
}

const activityIcon = {
  payment: DollarSign,
  document: FileText,
  vacation: Umbrella,
  register: UserPlus,
}

const activityColor = {
  payment: 'bg-success/10 text-success',
  document: 'bg-primary/10 text-primary',
  vacation: 'bg-warning/10 text-warning',
  register: 'bg-primary/10 text-primary',
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card>
        <SectionTitle
          title="Atividades Recentes"
          action={
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          }
        />
        <div className="space-y-1">
          {activities.map((activity, i) => {
            const Icon = activityIcon[activity.type]
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div
                  className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                    activityColor[activity.type]
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text">
                    <span className="font-semibold">{activity.person}</span>{' '}
                    {activity.description}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{activity.time}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
