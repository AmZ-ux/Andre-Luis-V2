import { logger } from '../utils/logger.js'
import { getDb } from '../database/connection.js'

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

function endpointHash(endpoint: string): string {
  let hash = 0
  for (let i = 0; i < endpoint.length; i++) {
    hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36).padStart(8, '0')
}

function categoryKey(userId: string, subscription: PushSubscription): string {
  return `push_sub_${userId}_${endpointHash(subscription.endpoint)}`
}

let webPush: any = null
let webPushAvailable = false

try {
  webPush = (await import('web-push')).default
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
    const key = categoryKey(userId, subscription)
    const existing = db.prepare('SELECT id FROM settings WHERE category = ?').get(key)
    if (existing) {
      db.prepare('UPDATE settings SET data = ?, updated_at = datetime(\'now\') WHERE category = ?')
        .run(JSON.stringify(subscription), key)
    } else {
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
      db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)')
        .run(id, key, JSON.stringify(subscription))
    }
    logger.info({ userId, key }, 'Push subscription saved')
  },

  async unsubscribe(userId: string, endpoint?: string): Promise<void> {
    const db = getDb()
    if (endpoint) {
      let hash = 0
      for (let i = 0; i < endpoint.length; i++) {
        hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0
      }
      const h = Math.abs(hash).toString(36).padStart(8, '0')
      db.prepare('DELETE FROM settings WHERE category = ?').run(`push_sub_${userId}_${h}`)
    } else {
      db.prepare("DELETE FROM settings WHERE category LIKE ?").run(`push_sub_${userId}_%`)
    }
  },

  removeSubscription(key: string): void {
    const db = getDb()
    db.prepare('DELETE FROM settings WHERE category = ?').run(key)
  },

  async send(userId: string, title: string, body: string, data?: Record<string, any>): Promise<number> {
    if (!webPushAvailable) {
      logger.info({ userId, title }, 'Push not available (no VAPID keys)')
      return 0
    }

    const db = getDb()
    const prefix = `push_sub_${userId}_`
    const rows = db.prepare("SELECT category, data FROM settings WHERE category LIKE ?").all(`${prefix}%`) as any[]
    if (!rows.length) {
      logger.warn({ userId }, 'Push send skipped: no subscriptions')
      return 0
    }

    let sent = 0
    for (const row of rows) {
      try {
        const subscription: PushSubscription = JSON.parse(row.data)
        await webPush.sendNotification(subscription, JSON.stringify({ title, body, ...data }))
        sent++
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.status || 0
        if (statusCode === 410) {
          this.removeSubscription(row.category)
          logger.info({ userId, key: row.category }, 'Push subscription expired (410), removed')
        } else {
          logger.error({ userId, statusCode, message: err?.message }, 'Push send failed')
        }
      }
    }

    logger.info({ userId, title, sent, total: rows.length }, 'Push send completed')
    return sent
  },

  async sendToAll(title: string, body: string, data?: Record<string, any>): Promise<number> {
    const db = getDb()
    const rows = db.prepare("SELECT category, data FROM settings WHERE category LIKE 'push_sub_%'").all() as any[]
    let sent = 0

    for (const row of rows) {
      try {
        const subscription: PushSubscription = JSON.parse(row.data)
        if (webPushAvailable) {
          await webPush.sendNotification(subscription, JSON.stringify({ title, body, ...data }))
        }
        sent++
      } catch (err: any) {
        const statusCode = err?.statusCode || err?.status || 0
        if (statusCode === 410) {
          this.removeSubscription(row.category)
          logger.info({ key: row.category }, 'Push subscription expired (410) in sendToAll, removed')
        } else {
          logger.error({ statusCode, message: err?.message }, 'Push sendToAll failed for subscription')
        }
      }
    }

    return sent
  },
}
