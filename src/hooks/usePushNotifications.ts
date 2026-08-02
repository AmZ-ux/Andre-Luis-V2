import { useEffect, useCallback, useState } from 'react'
import { config } from '../config'
import { api } from '../services/apiClient'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

  const checkStatus = useCallback(async () => {
    const swSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(swSupported)
    if (!swSupported) {
      setPermission('unsupported')
      setEnabled(false)
      return
    }
    setPermission(Notification.permission)
    if (Notification.permission !== 'granted') {
      setEnabled(false)
      return
    }
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setEnabled(!!sub)
    } catch {
      setEnabled(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const subscribe = useCallback(async () => {
    if (!config.realApi) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const { publicKey, available } = await api.get<{ publicKey: string; available: boolean }>('/communication/push/key')
      if (!available || !publicKey) return false

      let existing = await registration.pushManager.getSubscription()
      if (!existing) {
        existing = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        })
      }

      await api.post('/communication/push/subscribe', {
        subscription: { endpoint: existing.endpoint, keys: existing.toJSON() as any },
      })
      setEnabled(true)
      setPermission(Notification.permission)
      return true
    } catch (err: any) {
      if (err?.message === 'permission_denied' || (err as any)?.PermissionDenied) {
        setPermission('denied')
      }
      setEnabled(false)
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
      await api.post('/communication/push/unsubscribe')
      setEnabled(false)
    } catch {}
  }, [])

  const canEnable = config.realApi && supported && permission !== 'denied' && !enabled

  return { subscribe, unsubscribe, enabled, supported, permission, canEnable, refresh: checkStatus }
}