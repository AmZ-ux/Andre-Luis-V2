import { motion } from 'framer-motion'
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
  payment: 'bg-success/10 text-success',
  due: 'bg-warning/10 text-warning',
  document: 'bg-primary/10 text-primary',
  system: 'bg-gray-100 dark:bg-gray-800 text-gray-500',
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card>
        <SectionTitle
          title="Notificações"
          action={
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          }
        />
        <div className="space-y-1">
          {notifications.map((notif) => {
            const Icon = notifIcon[notif.type]
            return (
              <div
                key={notif.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-colors',
                  !notif.read && 'bg-primary/5 dark:bg-primary/10'
                )}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    notifColor[notif.type]
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text">{notif.title}</p>
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{notif.time}</span>
              </div>
            )
          })}
        </div>
      </Card>
    </motion.div>
  )
}
