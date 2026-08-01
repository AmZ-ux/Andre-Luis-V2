import { motion } from 'framer-motion'
import { Button } from '../ui/Button'
import {
  Bell, CheckCheck, Star, Archive, Info, CheckCircle, AlertTriangle, AlertCircle,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import type { Notification } from '../../types/communication'

interface NotificationPanelProps {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkFavorite: (id: string) => void
  onArchive: (id: string) => void
  onMarkAllRead: () => void
}

const typeIcons: Record<string, typeof Info> = {
  info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertCircle,
}
const typeColors: Record<string, string> = {
  info: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-error bg-error/10',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function NotificationPanel({ notifications, unreadCount, onMarkRead, onMarkFavorite, onArchive, onMarkAllRead }: NotificationPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-text">Notificações</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 rounded-full font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={onMarkAllRead}>
            Marcar todas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Bell className="h-6 w-6 text-gray-300" />
          <p className="text-xs text-gray-400">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const TypeIcon = typeIcons[notif.type] || Info
            const iconColorClass = typeColors[notif.type] || typeColors.info
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-all duration-200 group',
                  notif.status === 'unread'
                    ? 'bg-primary/[0.02] dark:bg-primary/[0.04]'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                )}
              >
                <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', iconColorClass)}>
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-xs', notif.status === 'unread' ? 'font-semibold text-text' : 'font-medium text-text')}>
                      {notif.title}
                    </p>
                    {notif.status === 'unread' && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {notif.status === 'unread' && (
                    <button onClick={() => onMarkRead(notif.id)} className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center" title="Marcar como lida" aria-label="Marcar como lida">
                      <CheckCheck className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  )}
                  {notif.status !== 'favorite' && (
                    <button onClick={() => onMarkFavorite(notif.id)} className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center" title="Favoritar" aria-label="Favoritar">
                      <Star className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  )}
                  <button onClick={() => onArchive(notif.id)} className="h-7 w-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center" title="Arquivar" aria-label="Arquivar">
                    <Archive className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
