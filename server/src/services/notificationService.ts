import { v4 as uuid } from 'uuid'
import { pushService } from './push.js'
import { logger } from '../utils/logger.js'

export interface NotificationOptions {
  type?: 'info' | 'success' | 'warning' | 'error'
  link?: string
  status?: 'unread' | 'read'
}

export function createNotification(db: any, userId: string, title: string, message: string, opts: NotificationOptions = {}): void {
  db.prepare(
    "INSERT INTO notifications (id, user_id, title, message, status, type, link) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), userId, title, message, opts.status || 'unread', opts.type || 'info', opts.link || '')
}

export function notifyUser(db: any, userId: string, title: string, message: string, opts: NotificationOptions = {}): void {
  createNotification(db, userId, title, message, opts)
  pushService.send(userId, title, message, { data: { path: opts.link } }).catch(() => undefined)
}

export function notifyAdmins(db: any, title: string, message: string, opts: NotificationOptions = {}): void {
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[]
  for (const admin of admins) {
    notifyUser(db, admin.id, title, message, opts)
  }
  if (admins.length > 0) {
    logger.info({ admins: admins.length, title }, 'Notified admins')
  }
}

export function getAdminIds(db: any): string[] {
  return (db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[]).map((a) => a.id)
}