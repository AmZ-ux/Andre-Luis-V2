import { useEffect, useCallback, useRef } from 'react'
import { config } from '../config'
import { api } from '../services/apiClient'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const registered = useRef(false)

  const subscribe = useCallback(async () => {
    if (!config.realApi) return
    if (registered.current) return
    registered.current = true

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const { publicKey, available } = await api.get<{ publicKey: string; available: boolean }>('/communication/push/key')
      if (!available || !publicKey) return

      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await api.post('/communication/push/subscribe', {
          subscription: { endpoint: existing.endpoint, keys: existing.toJSON() as any },
        })
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })

      await api.post('/communication/push/subscribe', {
        subscription: { endpoint: subscription.endpoint, keys: subscription.toJSON() as any },
      })
    } catch {}
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
      await api.post('/communication/push/unsubscribe')
    } catch {}
  }, [])

  useEffect(() => {
    subscribe()
  }, [subscribe])

  return { subscribe, unsubscribe }
}
