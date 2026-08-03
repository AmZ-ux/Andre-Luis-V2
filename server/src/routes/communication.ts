import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { whatsappService } from '../services/whatsapp.js'
import { pushService } from '../services/push.js'

const router = Router()

router.get('/', (_req, res) => {
  const db = getDb()
  const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()
  res.json(messages)
})

router.post('/', async (req, res) => {
  const db = getDb()
  const { title, subject, body, type, channel, recipients, recipientPhones, scheduledAt, templateId, priority } = req.body
  const id = uuid()

  const recipientList = recipients || []
  const phoneList = recipientPhones || []

  db.prepare(`
    INSERT INTO messages (id, title, subject, body, type, channel, recipients, scheduled_at, template_id, priority, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, subject || '', body, type || 'individual', channel || 'app', JSON.stringify(recipientList), scheduledAt || null, templateId || '', priority || 'normal', req.user!.userId)

  // Dispatch to channels
  if (channel === 'whatsapp' || channel === 'all') {
    if (phoneList.length > 0) {
      for (const phone of phoneList) {
        await whatsappService.send(phone, body).catch(() => {})
      }
    }
  }

  if (channel === 'push' || channel === 'all') {
    await pushService.sendToAll(title, body).catch(() => {})
  }

  if (channel === 'app' || channel === 'all') {
    // Create notification for each recipient
    const users = recipientList.length > 0
      ? recipientList
      : (db.prepare('SELECT id FROM users').all() as any[]).map((u: any) => u.id)

    for (const userId of users) {
      db.prepare(`INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'info')`)
        .run(uuid(), userId, title, body)
    }
  }

  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
})

// Send WhatsApp message
router.post('/whatsapp/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) {
    res.status(400).json({ error: 'Campos obrigatórios: to, message' })
    return
  }
  try {
    const result = await whatsappService.send(to, message)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Bulk WhatsApp
router.post('/whatsapp/bulk', async (req, res) => {
  const { recipients, messageTemplate } = req.body
  if (!recipients?.length || !messageTemplate) {
    res.status(400).json({ error: 'Campos obrigatórios: recipients, messageTemplate' })
    return
  }
  const result = await whatsappService.sendBulk(recipients, messageTemplate)
  res.json(result)
})

// Push subscription
router.post('/push/subscribe', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const { subscription } = req.body
  if (!subscription) { res.status(400).json({ error: 'Subscription não fornecida' }); return }
  pushService.subscribe(req.user.userId, subscription)
  res.json({ success: true })
})

router.post('/push/unsubscribe', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  pushService.unsubscribe(req.user.userId)
  res.json({ success: true })
})

router.get('/push/key', (_req, res) => {
  res.json({ publicKey: pushService.getPublicKey(), available: pushService.isAvailable() })
})

// Send push notification
router.post('/push/send', async (req, res) => {
  const { userIds, title, body, data } = req.body
  if (!userIds?.length || !title || !body) {
    res.status(400).json({ error: 'Campos obrigatórios: userIds, title, body' })
    return
  }
  let sent = 0
  for (const userId of userIds) {
    if (await pushService.send(userId, title, body, data)) sent++
  }
  res.json({ sent, total: userIds.length })
})

router.post('/push/send-all', async (req, res) => {
  const { title, body, data } = req.body
  if (!title || !body) {
    res.status(400).json({ error: 'Campos obrigatórios: title, body' })
    return
  }
  const sent = await pushService.sendToAll(title, body, data)
  res.json({ sent })
})

// Notifications
router.get('/notifications', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  res.json(db.prepare("SELECT * FROM notifications WHERE user_id = ? AND status != 'archived' ORDER BY created_at DESC LIMIT 50").all(req.user.userId))
})

router.get('/notifications/unread', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  res.json({ count: (db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND status = 'unread'").get(req.user.userId) as any).count })
})

// Atualiza status de uma notificação (read | favorite | archived)
router.patch('/notifications/:id', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const { status } = req.body || {}
  if (!['read', 'favorite', 'archived'].includes(status)) {
    res.status(400).json({ error: 'Status inválido. Use read, favorite ou archived' })
    return
  }
  const db = getDb()
  db.prepare('UPDATE notifications SET status = ?, read_at = CASE WHEN ? IN (\'read\', \'favorite\') THEN datetime(\'now\') ELSE read_at END WHERE id = ? AND user_id = ?')
    .run(status, status, req.params.id, req.user.userId)
  res.json({ success: true, id: req.params.id, status })
})

// Marca todas as notificações do usuário como lidas
router.post('/notifications/read-all', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  db.prepare("UPDATE notifications SET status = 'read', read_at = datetime('now') WHERE user_id = ? AND status = 'unread'").run(req.user.userId)
  res.json({ success: true })
})

// Channel status
router.get('/channels', (_req, res) => {
  res.json([
    { type: 'app', name: 'Notificação no App', icon: 'Bell', status: 'connected', enabled: true, configurable: false },
    { type: 'whatsapp', name: 'WhatsApp', icon: 'MessageCircle', status: (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE) ? 'connected' : 'disconnected', enabled: true, configurable: true },
    { type: 'push', name: 'Push Notification', icon: 'BellRing', status: pushService.isAvailable() ? 'connected' : 'disconnected', enabled: true, configurable: true },
    { type: 'email', name: 'E-mail', icon: 'Mail', status: 'disconnected', enabled: true, configurable: true },
    { type: 'sms', name: 'SMS', icon: 'MessageSquare', status: 'disconnected', enabled: true, configurable: true },
  ])
})

export default router
