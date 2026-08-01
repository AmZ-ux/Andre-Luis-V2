import { logger } from '../utils/logger.js'
import { getDb } from '../database/connection.js'

// VAPID keys for Web Push (generated at runtime if not set)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@transporteandreluis.com.br'

interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

let webPush: any = null
let webPushAvailable = false

try {
  webPush = await import('web-push')
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    webPushAvailable = true
  }
} catch {
  webPushAvailable = false
}

export const pushService = {
  isAvailable(): boolean {
    return webPushAvailable
  },

  getPublicKey(): string {
    return VAPID_PUBLIC_KEY
  },

  async subscribe(userId: string, subscription: PushSubscription): Promise<void> {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM settings WHERE category = ?').get(`push_sub_${userId}`)
    if (existing) {
      db.prepare('UPDATE settings SET data = ?, updated_at = datetime(\'now\') WHERE category = ?')
        .run(JSON.stringify(subscription), `push_sub_${userId}`)
    } else {
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
      db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
        .run(id, `push_sub_${userId}`, JSON.stringify(subscription))
    }
  },

  async unsubscribe(userId: string): Promise<void> {
    const db = getDb()
    db.prepare('DELETE FROM settings WHERE category = ?').run(`push_sub_${userId}`)
  },

  async send(userId: string, title: string, body: string, data?: Record<string, any>): Promise<boolean> {
    if (!webPushAvailable) {
      logger.info({ userId, title }, 'Push mock sent')
      return false
    }

    const db = getDb()
    const row = db.prepare('SELECT data FROM settings WHERE category = ?').get(`push_sub_${userId}`) as any
    if (!row) return false

    try {
      const subscription: PushSubscription = JSON.parse(row.data)
      await webPush.sendNotification(subscription, JSON.stringify({ title, body, ...data }))
      return true
    } catch (err: any) {
      if (err.statusCode === 410) {
        // Subscription expired, remove it
        this.unsubscribe(userId)
      }
      return false
    }
  },

  async sendToAll(title: string, body: string, data?: Record<string, any>): Promise<number> {
    const db = getDb()
    const rows = db.prepare("SELECT category, data FROM settings WHERE category LIKE 'push_sub_%'").all() as any[]
    let sent = 0

    for (const row of rows) {
      const userId = row.category.replace('push_sub_', '')
      try {
        const subscription: PushSubscription = JSON.parse(row.data)
        if (webPushAvailable) {
          await webPush.sendNotification(subscription, JSON.stringify({ title, body, ...data }))
        }
        sent++
      } catch {}
    }

    return sent
  },
}
