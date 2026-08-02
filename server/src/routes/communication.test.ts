import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { sanitizeBody } from '../middleware/validation.js'
import { resetDb, getDb } from '../database/connection.js'
import { authMiddleware } from '../middleware/auth.js'
import communicationRoutes from '../routes/communication.js'

process.env.DATABASE_PATH = ':memory:'

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use(sanitizeBody)
app.use('/api/communication', authMiddleware, communicationRoutes)

let token: string
let adminId: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  const db = getDb()
  adminId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', '', bcrypt.hashSync('password', 10))
  token = jwt.sign({ userId: adminId, role: 'admin' }, 'dev-secret-change-in-production')
})

function seedMessage(overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO messages (id, title, subject, body, type, channel, recipients, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.title ?? 'Test Message',
    overrides.subject ?? '',
    overrides.body ?? 'Message body',
    overrides.type ?? 'individual',
    overrides.channel ?? 'app',
    JSON.stringify(overrides.recipients ?? []),
    overrides.createdBy ?? adminId
  )
  return id
}

function seedNotification(overrides: Record<string, any> = {}): string {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, type, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.userId ?? adminId,
    overrides.title ?? 'Notification',
    overrides.message ?? 'Test notification',
    overrides.type ?? 'info',
    overrides.status ?? 'unread'
  )
  return id
}

describe('GET /api/communication', () => {
  it('should return empty list when no messages exist', async () => {
    const res = await request(app).get('/api/communication').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('should return all messages', async () => {
    seedMessage({ title: 'Message 1' })
    seedMessage({ title: 'Message 2' })
    const res = await request(app).get('/api/communication').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].title).toBeTruthy()
  })

  it('should order messages by created_at desc', async () => {
    seedMessage({ title: 'Old' })
    seedMessage({ title: 'New' })
    const res = await request(app).get('/api/communication').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

describe('POST /api/communication', () => {
  it('should create a message with app channel notifications', async () => {
    const db = getDb()
    const otherUserId = uuid()
    db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'passenger', ?)")
      .run(otherUserId, 'Passenger', 'pass@test.com', '222.222.222-22', bcrypt.hashSync('pass', 10))

    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Important Notice',
        subject: 'Notice',
        body: 'This is an important message',
        type: 'broadcast',
        channel: 'app',
        recipients: [adminId, otherUserId],
      })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.title).toBe('Important Notice')

    const notifications = db.prepare('SELECT * FROM notifications').all()
    expect(notifications).toHaveLength(2)
    expect(notifications.every((n: any) => n.title === 'Important Notice')).toBe(true)
  })

  it('should create a message with no recipients list (all users)', async () => {
    const db = getDb()
    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Broadcast',
        body: 'To all users',
        channel: 'app',
        recipients: [],
      })
    expect(res.status).toBe(201)

    const notifications = db.prepare('SELECT * FROM notifications').all()
    expect(notifications).toHaveLength(1)
  })

  it('should create a message with default channel when not specified', async () => {
    const res = await request(app)
      .post('/api/communication')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test', body: 'Body' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.title).toBe('Test')
    expect(res.body.channel).toBe('app')
  })
})

describe('GET /api/communication/notifications', () => {
  it('should return empty list when no notifications exist', async () => {
    const res = await request(app).get('/api/communication/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('should return notifications for the current user', async () => {
    seedNotification({ userId: adminId, title: 'Notif 1' })
    seedNotification({ userId: adminId, title: 'Notif 2' })
    const res = await request(app).get('/api/communication/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    const titles = res.body.map((n: any) => n.title)
    expect(titles).toContain('Notif 1')
    expect(titles).toContain('Notif 2')
  })

  it('should not return notifications for other users', async () => {
    const otherId = uuid()
    seedNotification({ userId: otherId, title: 'Other notif' })
    const res = await request(app).get('/api/communication/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('should not return archived notifications', async () => {
    seedNotification({ userId: adminId, title: 'Active', status: 'unread' })
    seedNotification({ userId: adminId, title: 'Archived', status: 'archived' })
    const res = await request(app).get('/api/communication/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].title).toBe('Active')
  })

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/communication/notifications')
    expect(res.status).toBe(401)
  })
})

describe('Notification status actions', () => {
  it('should return unread count for current user', async () => {
    seedNotification({ userId: adminId, title: 'Unread 1' })
    seedNotification({ userId: adminId, title: 'Unread 2' })
    seedNotification({ userId: adminId, title: 'Read', status: 'read' })
    const res = await request(app).get('/api/communication/notifications/unread').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
  })

  it('should mark a notification as read', async () => {
    const notifId = seedNotification({ userId: adminId, title: 'Test' })
    const res = await request(app)
      .patch(`/api/communication/notifications/${notifId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'read' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const row = getDb().prepare('SELECT status FROM notifications WHERE id = ?').get(notifId) as any
    expect(row.status).toBe('read')
  })

  it('should mark a notification as favorite', async () => {
    const notifId = seedNotification({ userId: adminId, title: 'Test' })
    const res = await request(app)
      .patch(`/api/communication/notifications/${notifId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'favorite' })
    expect(res.status).toBe(200)
    const row = getDb().prepare('SELECT status, read_at FROM notifications WHERE id = ?').get(notifId) as any
    expect(row.status).toBe('favorite')
    expect(row.read_at).toBeTruthy()
  })

  it('should reject an invalid status', async () => {
    const notifId = seedNotification({ userId: adminId, title: 'Test' })
    const res = await request(app)
      .patch(`/api/communication/notifications/${notifId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'spam' })
    expect(res.status).toBe(400)
  })

  it('should not update notification of another user', async () => {
    const otherId = uuid()
    const notifId = seedNotification({ userId: otherId, title: 'Other' })
    const res = await request(app)
      .patch(`/api/communication/notifications/${notifId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'read' })
    expect(res.status).toBe(200)
    const row = getDb().prepare('SELECT status FROM notifications WHERE id = ?').get(notifId) as any
    expect(row.status).toBe('unread')
  })

  it('should archive a notification and hide it from the list', async () => {
    const notifId = seedNotification({ userId: adminId, title: 'To archive' })
    const res = await request(app)
      .patch(`/api/communication/notifications/${notifId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'archived' })
    expect(res.status).toBe(200)
    const list = await request(app).get('/api/communication/notifications').set('Authorization', `Bearer ${token}`)
    expect(list.body.some((n: any) => n.id === notifId)).toBe(false)
  })

  it('should mark all notifications as read', async () => {
    seedNotification({ userId: adminId, title: 'A' })
    seedNotification({ userId: adminId, title: 'B' })
    const res = await request(app)
      .post('/api/communication/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const unread = getDb().prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND status = 'unread'").get(adminId) as any
    expect(unread.count).toBe(0)
  })
})
