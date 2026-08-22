import { Card } from '../ui/Card'
import { SectionTitle } from './SectionTitle'
import { Button } from '../ui/Button'
import type { Notification } from '../../types/dashboard'
import { DollarSign, Clock, FileText, Info } from 'lucide-react'
import { cn } from '../../utils/cn'

interface NotificationsPanelProps {
  notifications: Notification[]
}

const notifIcon = {
  payment: DollarSign,
  due: Clock,
  document: FileText,
  system: Info,
}

const notifColor = {
  payment: 'bg-success-soft text-success',
  due: 'bg-warning-soft text-warning',
  document: 'bg-primary-soft text-primary',
  system: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  return (
    <Card>
      <SectionTitle
        title="Notificações"
        action={
          <Button variant="ghost" size="sm">
            Ver todas
          </Button>
        }
      />
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {notifications.map((notif) => {
          const Icon = notifIcon[notif.type] || Info
          return (
            <li
              key={notif.id}
              className={cn(
                'flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 rounded-lg',
                !notif.read && 'px-2 -mx-2 bg-primary-soft/60'
              )}
            >
              <div
                className={cn(
                  'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                  notifColor[notif.type]
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text">{notif.title}</p>
                  {!notif.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-label="Não lida" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{notif.message}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 tabular-nums">{notif.time}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}