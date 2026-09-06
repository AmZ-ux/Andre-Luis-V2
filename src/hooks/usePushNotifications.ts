import { useEffect, useCallback, useState } from 'react'
import { config } from '../config'
import { api } from '../services/apiClient'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export type PushError =
  | 'unsupported'
  | 'notifications_blocked'
  | 'permission_denied'
  | 'push_not_available'
  | 'subscription_failed'
  | 'backend_failed'
  | 'unknown'

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PushError | null>(null)

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

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: PushError }> => {
    if (!config.realApi) return { ok: false, error: 'unsupported' }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return { ok: false, error: 'unsupported' }
    }

    setLoading(true)
    setError(null)

    try {
      let currentPermission = Notification.permission

      if (currentPermission === 'default') {
        const result = await Notification.requestPermission()
        currentPermission = result
      }

      if (currentPermission === 'denied') {
        setPermission('denied')
        setError('notifications_blocked')
        return { ok: false, error: 'notifications_blocked' }
      }

      if (currentPermission !== 'granted') {
        setError('permission_denied')
        return { ok: false, error: 'permission_denied' }
      }

      setPermission('granted')

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const { publicKey, available } = await api.get<{ publicKey: string; available: boolean }>('/communication/push/key')
      if (!available || !publicKey) {
        setError('push_not_available')
        return { ok: false, error: 'push_not_available' }
      }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
          })
        } catch (err: any) {
          const name = err?.name || ''
          if (name === 'NotAllowedError') {
            setError('permission_denied')
            return { ok: false, error: 'permission_denied' }
          }
          if (name === 'InvalidStateError') {
            subscription = await registration.pushManager.getSubscription()
            if (!subscription) {
              setError('subscription_failed')
              return { ok: false, error: 'subscription_failed' }
            }
          } else {
            setError('subscription_failed')
            return { ok: false, error: 'subscription_failed' }
          }
        }
      }

      if (!subscription) {
        setError('subscription_failed')
        return { ok: false, error: 'subscription_failed' }
      }

      try {
        const subJson = subscription.toJSON()
        await api.post('/communication/push/subscribe', {
          subscription: { endpoint: subJson.endpoint, keys: subJson.keys },
        })
      } catch {
        setError('backend_failed')
        return { ok: false, error: 'backend_failed' }
      }

      setEnabled(true)
      setPermission(Notification.permission)
      setError(null)
      return { ok: true }
    } catch (err: any) {
      setError('unknown')
      return { ok: false, error: 'unknown' }
    } finally {
      setLoading(false)
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

  return { subscribe, unsubscribe, enabled, supported, permission, canEnable, loading, error, refresh: checkStatus }
}
