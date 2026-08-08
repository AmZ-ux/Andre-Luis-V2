import type { Notification, NotificationStatus, NotificationPreferences } from '../types/communication'

const STORAGE_KEY = 'mock_notifications'
const PREFS_KEY = 'mock_notification_prefs'

const defaultPrefs: NotificationPreferences = {
  enabled: true,
  sound: true,
  reminders: true,
  messageTypes: {
    payment: true,
    availability: true,
    system: true,
    promotional: false,
  },
}

function loadNotifications(): Notification[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

function saveNotifications(items: Notification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const notificationService = {
  list(status?: NotificationStatus): Notification[] {
    const items = loadNotifications()
    if (status) return items.filter((n) => n.status === status)
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getUnreadCount(): number {
    return loadNotifications().filter((n) => n.status === 'unread').length
  },

  create(data: {
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
    link?: string
  }): Notification {
    const notification: Notification = {
      id: generateId(),
      title: data.title,
      message: data.message,
      status: 'unread',
      type: data.type,
      link: data.link,
      createdAt: new Date().toISOString(),
    }
    const items = loadNotifications()
    items.unshift(notification)
    saveNotifications(items)
    return notification
  },

  markAsRead(id: string): Notification {
    const items = loadNotifications()
    const index = items.findIndex((n) => n.id === id)
    if (index === -1) throw new Error('Notificação não encontrada')
    items[index].status = 'read'
    items[index].readAt = new Date().toISOString()
    saveNotifications(items)
    return items[index]
  },

  markAsFavorite(id: string): Notification {
    const items = loadNotifications()
    const index = items.findIndex((n) => n.id === id)
    if (index === -1) throw new Error('Notificação não encontrada')
    items[index].status = 'favorite'
    saveNotifications(items)
    return items[index]
  },

  archive(id: string): Notification {
    const items = loadNotifications()
    const index = items.findIndex((n) => n.id === id)
    if (index === -1) throw new Error('Notificação não encontrada')
    items[index].status = 'archived'
    saveNotifications(items)
    return items[index]
  },

  markAllAsRead(): void {
    const items = loadNotifications()
    items.forEach((n) => {
      if (n.status === 'unread') {
        n.status = 'read'
        n.readAt = new Date().toISOString()
      }
    })
    saveNotifications(items)
  },

  delete(id: string): void {
    saveNotifications(loadNotifications().filter((n) => n.id !== id))
  },

  getPreferences(): NotificationPreferences {
    const stored = localStorage.getItem(PREFS_KEY)
    return stored ? JSON.parse(stored) : defaultPrefs
  },

  updatePreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.getPreferences()
    const updated = { ...current, ...prefs }
    if (prefs.messageTypes) {
      updated.messageTypes = { ...current.messageTypes, ...prefs.messageTypes }
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated))
    return updated
  },
}
