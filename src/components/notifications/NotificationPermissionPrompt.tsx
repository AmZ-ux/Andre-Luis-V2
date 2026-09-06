import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useToast } from '../../contexts/ToastContext'

const DISMISS_KEY = 'notification_prompt_dismissed_at'
const DISMISS_DAYS = 7

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (Number.isNaN(dismissedAt)) return false
    const diffMs = Date.now() - dismissedAt
    return diffMs < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
}

export function NotificationPermissionPrompt() {
  const [visible, setVisible] = useState(false)
  const { subscribe, supported, permission, enabled } = usePushNotifications()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)

  const shouldShow = useCallback(() => {
    if (!supported) return false
    if (permission !== 'default') return false
    if (enabled) return false
    if (isDismissedRecently()) return false
    if (isIOS() && !isPWAInstalled()) return false
    return true
  }, [supported, permission, enabled])

  useEffect(() => {
    if (shouldShow()) {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [shouldShow])

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
    setVisible(false)
  }, [])

  const handleActivate = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const ok = await subscribe()
      if (ok) {
        addToast('success', 'Notificações ativadas')
        setVisible(false)
      }
    } finally {
      setLoading(false)
    }
  }, [loading, subscribe, addToast])

  if (!visible) return null

  return (
    <Modal isOpen={visible} onClose={handleDismiss}>
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="h-14 w-14 rounded-2xl bg-primary-soft flex items-center justify-center">
          <Bell className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">Ative as notificações</h3>
          <p className="text-sm text-gray-500 mt-1">
            Receba avisos importantes sobre mensalidades, comunicados e atualizações do transporte.
          </p>
        </div>
        <div className="flex flex-col w-full gap-2 mt-2">
          <button
            onClick={handleActivate}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {loading ? 'Ativando...' : 'Ativar notificações'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </Modal>
  )
}
