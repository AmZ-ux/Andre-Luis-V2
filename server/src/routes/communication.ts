import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { getDb } from '../database/connection.js'
import { whatsappService } from '../services/whatsapp.js'
import { pushService } from '../services/push.js'
import { sendEmail, emailConfigured } from '../services/emailService.js'
import { alertIntegrationIssue } from '../services/integrationAlert.js'
import { logger } from '../utils/logger.js'
import { requireAdmin } from '../middleware/roles.js'

const router = Router()

function addHistory(db: any, messageId: string, action: string, description: string, performedBy: string): void {
  db.prepare('INSERT INTO message_history (id, message_id, action, description, performed_by) VALUES (?, ?, ?, ?, ?)')
    .run(uuid(), messageId, action, description || '', performedBy)
}

function resolveTargetUserIds(db: any, message: any): string[] {
  const raw = message.recipients || '[]'
  const parsed = (() => { try { return JSON.parse(raw) } catch { return [] } })()
  const recipients = Array.isArray(parsed) ? parsed : []
  if (recipients.length > 0) {
    return recipients.map((r: any) => (typeof r === 'string' ? r : r.id)).filter(Boolean)
  }
  return (db.prepare("SELECT id FROM users WHERE role = 'passenger'").all() as any[]).map((u: any) => u.id)
}

export type DispatchChannelResult = {
  channel: string
  status: 'sent' | 'skipped' | 'failed'
  delivered?: number
  attempted?: number
  detail?: string
}

export type DispatchResult = {
  success: boolean
  status: 'sent' | 'failed'
  reason?: string
  channels: DispatchChannelResult[]
}

const DISPATCH_TIMEOUT_MS = 10_000

function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function withTimeout<T>(promise: Promise<T>, ms: number, provider: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ao aguardar provedor (${provider})`)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) }
    )
  })
}

function runAppSync(db: any, message: any, targetUserIds: string[]): DispatchChannelResult {
  try {
    if (targetUserIds.length === 0) {
      return { channel: 'app', status: 'skipped', delivered: 0, attempted: 0, detail: 'nenhum destinatário' }
    }
    let delivered = 0
    for (const userId of targetUserIds) {
      db.prepare(`INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, 'info')`)
        .run(uuid(), userId, message.title, message.body)
      delivered++
    }
    return { channel: 'app', status: 'sent', delivered, attempted: targetUserIds.length }
  } catch (err: any) {
    logger.error({ err, messageId: message.id }, 'App channel notification insert failed')
    return { channel: 'app', status: 'failed', attempted: targetUserIds.length, detail: String(err?.message || err) }
  }
}

async function runWhatsApp(db: any, message: any): Promise<DispatchChannelResult> {
  try {
    const recipients = (() => { try { return JSON.parse(message.recipients || '[]') } catch { return [] } })()
    const phones: string[] = []
    for (const r of recipients) {
      const phone = r?.phone || r?.value || ''
      if (phone) phones.push(phone)
    }
    if (phones.length === 0) {
      return { channel: 'whatsapp', status: 'skipped', delivered: 0, attempted: 0, detail: 'sem destinatários com telefone' }
    }
    const results = await Promise.all(phones.map(async (phone) => {
      try {
        await withTimeout(whatsappService.send(phone, message.body), DISPATCH_TIMEOUT_MS, 'whatsapp')
        return { phone, ok: true as const, error: '' }
      } catch (err: any) {
        alertIntegrationIssue(db, 'WhatsApp', `Falha ao enviar mensagem para ${phone}`)
        return { phone, ok: false as const, error: String(err?.message || err) }
      }
    }))
    const delivered = results.filter((r) => r.ok).length
    if (delivered > 0) {
      return {
        channel: 'whatsapp',
        status: 'sent',
        delivered,
        attempted: phones.length,
        ...(delivered < phones.length ? { detail: `parcial: ${delivered} de ${phones.length}` } : {}),
      }
    }
    const failures = results.filter((r) => !r.ok).map((r) => `${r.phone}: ${r.error}`)
    return { channel: 'whatsapp', status: 'failed', delivered: 0, attempted: phones.length, detail: failures.join('; ') }
  } catch (err: any) {
    return { channel: 'whatsapp', status: 'failed', detail: String(err?.message || err) }
  }
}

async function runEmail(db: any, message: any, targetUserIds: string[]): Promise<DispatchChannelResult> {
  try {
    const recipients = (() => { try { return JSON.parse(message.recipients || '[]') } catch { return [] } })()
    const emails: string[] = []
    for (const r of recipients) {
      const email = r?.email || (typeof r === 'string' && /@/.test(r) ? r : '')
      if (email) { emails.push(email); continue }
      const uid = r?.id || (typeof r === 'string' && !/@/.test(r) ? r : '')
      if (uid) {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(uid) as any
        if (user?.email) emails.push(user.email)
      }
    }
    if (emails.length === 0 && targetUserIds.length > 0) {
      const placeholders = targetUserIds.map(() => '?').join(',')
      const all = db.prepare(`SELECT email FROM users WHERE id IN (${placeholders}) AND email != ''`).all(...targetUserIds) as any[]
      for (const u of all) if (u.email) emails.push(u.email)
    }
    const targets = [...new Set(emails)]
    if (targets.length === 0) {
      return { channel: 'email', status: 'skipped', delivered: 0, attempted: 0, detail: 'sem destinatários com e-mail' }
    }
    const results = await Promise.all(targets.map(async (email) => {
      try {
        await withTimeout(sendEmail(email, message.subject || message.title || 'Comunicado', `<p>${message.body}</p>`), DISPATCH_TIMEOUT_MS, 'email')
        return { email, ok: true as const, error: '' }
      } catch (err: any) {
        logger.error({ email, err: String(err) }, 'Message email delivery failed')
        alertIntegrationIssue(db, 'E-mail (Resend)', `Falha ao enviar email para ${email}: ${err}`)
        return { email, ok: false as const, error: String(err?.message || err) }
      }
    }))
    const delivered = results.filter((r) => r.ok).length
    if (delivered > 0) {
      return {
        channel: 'email',
        status: 'sent',
        delivered,
        attempted: targets.length,
        ...(delivered < targets.length ? { detail: `parcial: ${delivered} de ${targets.length}` } : {}),
      }
    }
    const failures = results.filter((r) => !r.ok).map((r) => `${r.email}: ${r.error}`)
    return { channel: 'email', status: 'failed', delivered: 0, attempted: targets.length, detail: failures.join('; ') }
  } catch (err: any) {
    return { channel: 'email', status: 'failed', detail: String(err?.message || err) }
  }
}

async function runPush(message: any, targetUserIds: string[]): Promise<DispatchChannelResult> {
  try {
    if (targetUserIds.length === 0) {
      return { channel: 'push', status: 'skipped', delivered: 0, attempted: 0, detail: 'nenhum destinatário' }
    }
    if (!pushService.isAvailable()) {
      return { channel: 'push', status: 'skipped', delivered: 0, attempted: 0, detail: 'push não configurado (VAPID ausente)' }
    }
    const results = await Promise.all(targetUserIds.map(async (userId) => {
      try {
        return await withTimeout(pushService.sendDetailed(userId, message.title, message.body, { data: { path: '/' } }), DISPATCH_TIMEOUT_MS, 'push')
      } catch {
        return { sent: 0, total: 1, available: true }
      }
    }))
    let sent = 0
    let total = 0
    for (const r of results) { sent += r.sent; total += r.total }
    if (total === 0) {
      return { channel: 'push', status: 'skipped', delivered: 0, attempted: 0, detail: 'nenhuma subscription' }
    }
    if (sent === 0) {
      return { channel: 'push', status: 'failed', delivered: 0, attempted: total, detail: `falha ao enviar para ${total} subscription(s)` }
    }
    return {
      channel: 'push',
      status: 'sent',
      delivered: sent,
      attempted: total,
      ...(sent < total ? { detail: `parcial: ${sent} de ${total}` } : {}),
    }
  } catch (err: any) {
    return { channel: 'push', status: 'failed', detail: String(err?.message || err) }
  }
}

function channelSummary(channels: DispatchChannelResult[]): string {
  return channels.map((c) => `${c.channel}: ${c.status}${c.detail ? ` (${c.detail})` : ''}`).join('; ')
}

function markFailed(db: any, message: any, reason: string): void {
  try {
    const detail = truncate(reason)
    db.prepare("UPDATE messages SET status = 'failed', failed_at = datetime('now'), error_message = ?, updated_at = datetime('now') WHERE id = ?").run(detail, message.id)
    addHistory(db, message.id, 'failed', detail, 'system')
  } catch (err: any) {
    logger.error({ err, messageId: message.id }, 'Failed to persist message failure')
  }
}

function finalize(db: any, message: any, channels: DispatchChannelResult[]): DispatchResult {
  const summary = channelSummary(channels)
  const hasFailure = channels.some((c) => c.status === 'failed')
  const hasSent = channels.some((c) => c.status === 'sent')

  if (!hasFailure && hasSent) {
    db.prepare("UPDATE messages SET status = 'sent', sent_at = datetime('now'), error_message = '', updated_at = datetime('now') WHERE id = ?").run(message.id)
    addHistory(db, message.id, 'sent', `Mensagem enviada via canal ${message.channel}`, 'system')
    return { success: true, status: 'sent', channels }
  }

  const reason = hasFailure ? summary : `Nenhum destinatário elegível — ${summary}`
  markFailed(db, message, reason)
  return { success: false, status: 'failed', reason, channels }
}

/**
 * Despacha a mensagem pelos canais selecionados e só marca `sent` após
 * confirmação real de todos eles. Regra estrita:
 * - qualquer canal `failed` → mensagem `failed`;
 * - ≥1 canal `sent` e nenhum `failed` → `sent`;
 * - todos `skipped` → `failed`.
 * Nunca lança exceção; retorna resultado estruturado.
 */
export async function dispatchMessage(db: any, message: any): Promise<DispatchResult> {
  try {
    const channel = String(message.channel || 'app')
    const targetUserIds = resolveTargetUserIds(db, message)
    const supported = ['app', 'whatsapp', 'email', 'push']
    const isAll = channel === 'all'

    const pending: Promise<DispatchChannelResult>[] = []
    if (isAll || channel === 'whatsapp') pending.push(runWhatsApp(db, message))
    if (isAll || channel === 'email') pending.push(runEmail(db, message, targetUserIds))
    if (isAll || channel === 'push') pending.push(runPush(message, targetUserIds))

    const results: DispatchChannelResult[] = []
    if (isAll || channel === 'app') {
      results.push(runAppSync(db, message, targetUserIds))
    } else if (!supported.includes(channel)) {
      results.push({
        channel,
        status: 'failed',
        detail: channel === 'sms' ? 'Canal sms não suportado' : `Canal desconhecido: ${channel}`,
      })
    }

    results.push(...(await Promise.all(pending)))
    return finalize(db, message, results)
  } catch (err: any) {
    logger.error({ err, messageId: message.id }, 'dispatchMessage failed')
    const reason = `Erro interno de dispatch: ${String(err?.message || err)}`
    markFailed(db, message, reason)
    return { success: false, status: 'failed', reason, channels: [] }
  }
}

router.get('/', requireAdmin, (_req, res) => {
  const db = getDb()
  res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all())
})

router.post('/', requireAdmin, async (req, res, next) => {
  const db = getDb()
  try {
    const { title, subject, body, type, channel, recipients, scheduledAt, templateId, priority } = req.body
    const id = uuid()

    const recipientList = recipients || []

    const status = scheduledAt ? 'scheduled' : 'draft'

    db.prepare(`
      INSERT INTO messages (id, title, subject, body, type, channel, recipients, scheduled_at, template_id, priority, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, subject || '', body, type || 'individual', channel || 'app', JSON.stringify(recipientList), scheduledAt || null, templateId || '', priority || 'normal', status, req.user!.userId)

    addHistory(db, id, status === 'scheduled' ? 'scheduled' : 'created', status === 'scheduled' ? `Agendada para ${scheduledAt}` : `Mensagem criada: ${title}`, req.user!.role === 'admin' ? 'Administrador' : 'Passageiro')

    if (status !== 'scheduled') {
      await dispatchMessage(db, db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
    }

    res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(id))
  } catch (err) {
    next(err)
  }
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
  addHistory(db, String(req.params.id), action || 'created', description || '', req.user!.role === 'admin' ? 'Administrador' : 'Passageiro')
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
  addHistory(db, String(req.params.id), status === 'cancelled' ? 'cancelled' : status, `Status alterado para ${status}`, req.user!.role === 'admin' ? 'Administrador' : 'Passageiro')
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
  addHistory(db, messageId, 'scheduled', `Agendada para ${date} às ${time}`, req.user!.role === 'admin' ? 'Administrador' : 'Passageiro')
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
  const { endpoint } = req.body
  pushService.unsubscribe(req.user.userId, endpoint)
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
    sent += await pushService.send(userId, title, body, data)
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
    { type: 'email', name: 'E-mail', icon: 'Mail', status: emailConfigured() ? 'connected' : 'disconnected', enabled: true, configurable: true },
    { type: 'sms', name: 'SMS', icon: 'MessageSquare', status: 'disconnected', enabled: false, configurable: true },
  ])
})

// Preferências de notificação e canais habilitados por usuário
function loadUserPrefs(db: any, userId: string): any {
  const row = db.prepare('SELECT data FROM settings WHERE category = ?').get(`user_prefs_${userId}`) as any
  if (!row) return {}
  try { return JSON.parse(row.data) } catch { return {} }
}

function saveUserPrefs(db: any, userId: string, data: any): void {
  const category = `user_prefs_${userId}`
  const raw = JSON.stringify(data)
  const existing = db.prepare('SELECT id FROM settings WHERE category = ?').get(category)
  if (existing) {
    db.prepare("UPDATE settings SET data = ?, updated_at = datetime('now') WHERE category = ?").run(raw, category)
  } else {
    db.prepare('INSERT INTO settings (id, category, data) VALUES (?, ?, ?)').run(uuid(), category, raw)
  }
}

router.get('/preferences', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  res.json(loadUserPrefs(db, req.user.userId))
})

router.put('/preferences', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return }
  const db = getDb()
  const { prefs, channelEnabled } = req.body || {}
  const current = loadUserPrefs(db, req.user.userId)
  const updated = {
    prefs: { ...(current.prefs || {}), ...(prefs || {}) },
    channelEnabled: { ...(current.channelEnabled || {}), ...(channelEnabled || {}) },
  }
  if (prefs?.messageTypes) {
    updated.prefs.messageTypes = { ...((current.prefs || {}).messageTypes || {}), ...prefs.messageTypes }
  }
  saveUserPrefs(db, req.user.userId, updated)
  res.json(updated)
})

export default router
