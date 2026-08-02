import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/apiClient'
import type { Notification, NotificationStatus } from '../types/communication'

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  notSupported: boolean
  markRead: (id: string) => void
  markFavorite: (id: string) => void
  archive: (id: string) => void
  markAllRead: () => void
  refresh: () => void
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notSupported, setNotSupported] = useState(false)
  const polling = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        api.get<Notification[]>('/communication/notifications'),
        api.get<{ count: number }>('/communication/notifications/unread'),
      ])
      setNotifications(list || [])
      setUnreadCount(Number(unread?.count) || 0)
    } catch {
      setNotSupported(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    polling.current = setInterval(load, 60_000)
    return () => {
      if (polling.current) clearInterval(polling.current)
    }
  }, [load])

  const patch = useCallback((id: string, status: NotificationStatus) => {
    api.patch(`/communication/notifications/${id}`, { status }).catch(() => {})
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status, readAt: status === 'read' || status === 'favorite' ? n.readAt || new Date().toISOString() : n.readAt } : n)))
    if (status !== 'unread') {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }, [])

  const refresh = useCallback(() => {
    load()
  }, [load])

  const markRead = useCallback((id: string) => patch(id, 'read'), [patch])
  const markFavorite = useCallback((id: string) => patch(id, 'favorite'), [patch])
  const archive = useCallback((id: string) => {
    api.patch(`/communication/notifications/${id}`, { status: 'archived' }).catch(() => {})
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const markAllRead = useCallback(() => {
    api.post('/communication/notifications/read-all').catch(() => {})
    setNotifications((prev) => prev.map((n) => (n.status === 'unread' ? { ...n, status: 'read', readAt: n.readAt || new Date().toISOString() } : n)))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, loading, notSupported, refresh, markRead, markFavorite, archive, markAllRead }
}