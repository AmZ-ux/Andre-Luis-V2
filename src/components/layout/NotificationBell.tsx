import { useState, useEffect, useRef } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { NotificationPanel } from '../communication/NotificationPanel'
import { cn } from '../../utils/cn'

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, loading, notSupported, markRead, markFavorite, archive, markAllRead } = useNotifications()
  const push = usePushNotifications()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-11 w-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto sm:right-0 top-[68px] sm:top-[calc(100%+8px)] sm:w-[380px] mx-2 sm:mx-0 max-h-[70vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-text">
                {push.enabled ? 'Notificações ativas no navegador' : notSupported ? 'Notificações indisponíveis' : 'Central de notificações'}
              </h3>
            </div>
            {!push.enabled && (
              <button
                onClick={() => push.subscribe()}
                disabled={!push.canEnable}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40',
                  push.canEnable
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-gray-400 cursor-not-allowed'
                )}
              >
                Ativar push
              </button>
            )}
          </div>
          {loading ? (
            <p className="text-xs text-gray-400 py-6 text-center">Carregando...</p>
          ) : (
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markRead}
              onMarkFavorite={markFavorite}
              onArchive={archive}
              onMarkAllRead={markAllRead}
            />
          )}
        </div>
      )}
    </div>
  )
}