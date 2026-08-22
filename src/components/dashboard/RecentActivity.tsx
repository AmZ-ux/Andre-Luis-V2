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
  payment: 'bg-success-soft text-success',
  document: 'bg-primary-soft text-primary',
  vacation: 'bg-warning-soft text-warning',
  register: 'bg-primary-soft text-primary',
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <SectionTitle
        title="Atividades recentes"
        action={
          <Button variant="ghost" size="sm">
            Ver todas
          </Button>
        }
      />
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {activities.map((activity) => {
          const Icon = activityIcon[activity.type] || FileText
          return (
            <li key={activity.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                  activityColor[activity.type]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="flex-1 min-w-0 text-sm text-text leading-snug">
                <span className="font-semibold">{activity.person}</span>{' '}
                {activity.description}
              </p>
              <span className="text-xs text-gray-400 shrink-0 tabular-nums">{activity.time}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}