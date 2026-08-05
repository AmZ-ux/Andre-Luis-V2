import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { whatsappService } from '../services/whatsapp.js'
import { pushService } from '../services/push.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

function addHistory(db: any, messageId: string, action: string, description: string, performedBy: string): void {
  db.prepare('INSERT INTO message_history (id, message_id, action, description, performed_by) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), messageId, action, description || '', performedBy)
}

export function dispatchMessage(db: any, message: any): void {
  const recipients = (() => { try { return JSON.parse(message.recipients || '[]') } catch { return [] } })()

  if (message.channel === 'whatsapp' || message.channel === 'all') {
    if (recipients.length > 0) {
      for (const r of recipients) {
        const phone = r?.phone || r?.value || ''
        if (phone) whatsappService.send(phone, message.body).catch(() => {})
      }
    }
  }

  if (message.channel === 'push' || message.channel === 'all') {
    pushService.sendToAll(message.title, message.body).catch(() => {})
  }

  if (message.channel === 'app' || message.channel === 'all') {
    const users = recipients.length > 0
      ? recipients.map((r: any) => (typeof r === 'string' ? r : r.id)).filter(Boolean)
      : (db.prepare('SELECT id FROM users').all() as any[]).map((u: any) => u.id)
    for (const userId of users) {
      db.prepare(`INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'info')`)
        .run(uuid(), userId, message.title, message.body)
    }
  }

  db.prepare("UPDATE messages SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(message.id)
  addHistory(db, message.id, 'sent', `Mensagem enviada via canal ${message.channel}`, 'system')
}

router.get('/', requireAdmin, (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all())
})

router.post('/', requireAdmin, (req, res) => {
  const db = getDb()
  const { title, subject, body, type, channel, recipients, scheduledAt, templateId, priority } = req.body
  const id = uuid()

  const recipientList = recipients || []

  const status = scheduledAt ? 'scheduled' : 'draft'

  db.prepare(`
    INSERT INTO messages (id, title, subject, body, type, channel, recipients, scheduled_at, template_id, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, subject || '', body, type || 'individual', channel || 'app', JSON.stringify(recipientList), scheduledAt || null, templateId || '', priority || 'normal', status, req.user!.userId)

  addHistory(db, id, status === 'scheduled' ? 'scheduled' : 'created', status === 'scheduled' ? `Agendada para ${scheduledAt}` : `Mensagem criada: ${title}`, req.user!.userName || req.user!.userId)

  if (status !== 'scheduled') {
    dispatchMessage(db, db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
  }

  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
})

router.get('/messages/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id)
  if (!message) { res.status(404).json({ error: 'Mensagem não encontrada' }); return }
  const history = db.prepare('SELECT * FROM message_history WHERE message_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ message, history })
})

router.get('/messages/:id/history', requireAdmin, (req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM message_history WHERE message_id = ? ORDER BY created_at DESC').all(req.params.id))
})

router.post('/messages/:id/history', requireAdmin, (req, res) => {
  const db = getDb()
  const { action, description } = req.body || {}
  const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Mensagem não encontrada' }); return }
  addHistory(db, req.params.id, action || 'created', description || '', req.user!.userName || req.user!.userId)
  res.status(201).json(db.prepare('SELECT * FROM message_history WHERE message_id = ? ORDER BY created_at DESC').all(req.params.id)[0])
})

router.put('/messages/:id/status', requireAdmin, (req, res) => {
  const db = getDb()
  const { status } = req.body || {}
  if (!['draft', 'scheduled', 'sent', 'failed', 'cancelled'].includes(status)) {
    res.status(400).json({ error: 'Status inválido' })
    return
  }
  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as any
  if (!existing) { res.status(404).json({ error: 'Mensagem não encontrada' }); return }

  db.prepare("UPDATE messages SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id)
  if (status === 'sent') {
    db.prepare("UPDATE messages SET sent_at = datetime('now') WHERE id = ?").run(req.params.id)
  }
  if (status === 'cancelled') {
    db.prepare("UPDATE messages SET scheduled_at = NULL WHERE id = ?").run(req.params.id)
  }
  addHistory(db, req.params.id, status === 'cancelled' ? 'cancelled' : status, `Status alterado para ${status}`, req.user!.userName || req.user!.userId)
  res.json(db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id))
})

router.delete('/messages/:id', requireAdmin, (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM message_history WHERE message_id = ?').run(req.params.id)
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// Templates de mensagens
router.get('/templates', requireAdmin, (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM message_templates ORDER BY created_at DESC').all())
})

router.post('/templates', requireAdmin, (req, res) => {
  const db = getDb()
  const { name, category, subject, body, channel } = req.body
  if (!name || !body) {
    res.status(400).json({ error: 'Campos obrigatórios: name, body' })
    return
  }
  const variables = Array.from(new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])))
  const id = uuid()
  db.prepare(`
    INSERT INTO message_templates (id, name, category, subject, body, variables, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, category || 'custom', subject || '', body, JSON.stringify(variables), channel || 'app')
  res.status(201).json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(id))
})

router.put('/templates/:id', requireAdmin, (req, res) => {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM message_templates WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Template não encontrado' }); return }

  const { name, category, subject, body, channel } = req.body
  const sets: string[] = ["updated_at = datetime('now')"]
  const params: any[] = []
  if (name !== undefined) { sets.push('name = ?'); params.push(name) }
  if (category !== undefined) { sets.push('category = ?'); params.push(category) }
  if (subject !== undefined) { sets.push('subject = ?'); params.push(subject) }
  if (channel !== undefined) { sets.push('channel = ?'); params.push(channel) }
  if (body !== undefined) {
    const variables = Array.from(new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])))
    sets.push('body = ?'); params.push(body)
    sets.push('variables = ?'); params.push(JSON.stringify(variables))
  }
  if (sets.length === 1) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return }
  params.push(req.params.id)
  db.prepare(`UPDATE message_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  res.json(db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id))
})

router.delete('/templates/:id', requireAdmin, (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM message_templates WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// Agendamentos: mensagens com scheduled_at no futuro
router.get('/schedules', requireAdmin, (_req, res) => {
  const db = getDb()
  const rows = db.prepare("SELECT * FROM messages WHERE status = 'scheduled' AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC").all() as any[]
  res.json(rows.map((m: any) => {
    const at = new Date(m.scheduled_at)
    return {
      id: m.id,
      messageId: m.id,
      title: m.title,
      body: m.body,
      scheduledDate: `${String(at.getDate()).padStart(2, '0')}/${String(at.getMonth() + 1).padStart(2, '0')}/${at.getFullYear()}`,
      scheduledTime: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
      scheduledAt: m.scheduled_at,
      status: 'pending',
      createdAt: m.created_at,
      channel: m.channel,
    }
  }))
})

router.post('/schedules', requireAdmin, (req, res) => {
  const db = getDb()
  const { messageId, date, time } = req.body || {}
  const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as any
  if (!existing) { res.status(404).json({ error: 'Mensagem não encontrada' }); return }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date || '')
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time || '')
  if (!match || !timeMatch) { res.status(400).json({ error: 'Data (DD/MM/AAAA) e hora (HH:mm) inválidas' }); return }

  const scheduledAt = `${match[3]}-${match[2]}-${match[1]}T${time}:00`
  db.prepare("UPDATE messages SET scheduled_at = ?, status = 'scheduled', updated_at = datetime('now') WHERE id = ?").run(scheduledAt, messageId)
  addHistory(db, messageId, 'scheduled', `Agendada para ${date} às ${time}`, req.user!.userName || req.user!.userId)
  res.json({ id: messageId, messageId, scheduledDate: date, scheduledTime: time, scheduledAt, status: 'pending', createdAt: existing.created_at })
})

// Send WhatsApp message
router.post('/whatsapp/send', requireAdmin, async (req, res) => {
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
router.post('/whatsapp/bulk', requireAdmin, async (req, res) => {
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
router.post('/push/send', requireAdmin, async (req, res) => {
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

router.post('/push/send-all', requireAdmin, async (req, res) => {
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

router.delete('/notifications/:id', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId)
  res.status(204).end()
})

// Channel status
router.get('/channels', (_req, res) => {
  res.json([
    { type: 'app', name: 'Aplicativo', icon: 'Smartphone', status: 'connected', enabled: true, configurable: false },
    { type: 'whatsapp', name: 'WhatsApp', icon: 'MessageCircle', status: (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE) ? 'connected' : 'disconnected', enabled: true, configurable: true },
    { type: 'push', name: 'Push Notification', icon: 'BellRing', status: pushService.isAvailable() ? 'connected' : 'disconnected', enabled: true, configurable: true },
    { type: 'email', name: 'E-mail', icon: 'Mail', status: 'disconnected', enabled: true, configurable: true },
    { type: 'sms', name: 'SMS', icon: 'MessageSquare', status: 'disconnected', enabled: true, configurable: true },
  ])
})

export default router
