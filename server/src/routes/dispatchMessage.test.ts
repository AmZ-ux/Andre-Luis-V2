import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { v4 as uuid } from 'uuid'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb } from '../database/connection.js'
import { dispatchMessage } from './communication.js'
import { whatsappService } from '../services/whatsapp.js'
import { sendEmail } from '../services/emailService.js'
import { pushService } from '../services/push.js'

vi.mock('../services/whatsapp.js', () => ({
  whatsappService: { send: vi.fn(), sendBulk: vi.fn() },
}))

vi.mock('../services/emailService.js', () => ({
  sendEmail: vi.fn(),
  emailConfigured: vi.fn(() => false),
  emailDisabled: vi.fn(() => false),
}))

vi.mock('../services/push.js', () => ({
  pushService: {
    isAvailable: vi.fn(() => false),
    sendDetailed: vi.fn(() => Promise.resolve({ sent: 0, total: 0, available: false })),
    send: vi.fn(() => Promise.resolve(0)),
    sendToAll: vi.fn(() => Promise.resolve(0)),
    getPublicKey: vi.fn(() => ''),
    subscribe: vi.fn(() => Promise.resolve()),
    unsubscribe: vi.fn(() => Promise.resolve()),
    removeSubscription: vi.fn(),
  },
}))

process.env.DATABASE_PATH = ':memory:'

const whatsappSend = vi.mocked(whatsappService.send)
const emailSend = vi.mocked(sendEmail)
const pushIsAvailable = vi.mocked(pushService.isAvailable)
const pushSendDetailed = vi.mocked(pushService.sendDetailed)

let adminId: string
let passengerId: string

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
  vi.clearAllMocks()
  const db = getDb()
  adminId = uuid()
  passengerId = uuid()
  db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'admin', ?)")
    .run(adminId, 'Admin', 'admin@test.com', '000.000.000-00', 'x')
  db.prepare("INSERT INTO users (id, name, email, cpf, role, password_hash) VALUES (?, ?, ?, ?, 'passenger', ?)")
    .run(passengerId, 'Passenger', 'pass@test.com', '111.111.111-11', 'x')

  whatsappSend.mockResolvedValue({ success: true, messageId: 'wa-1' })
  emailSend.mockResolvedValue(undefined)
  pushIsAvailable.mockReturnValue(false)
  pushSendDetailed.mockResolvedValue({ sent: 0, total: 0, available: false })
})

afterEach(() => {
  vi.useRealTimers()
})

function seedMessage(channel: string, recipients: any[] = []): any {
  const db = getDb()
  const id = uuid()
  db.prepare(`
    INSERT INTO messages (id, title, subject, body, type, channel, recipients, status, created_by)
    VALUES (?, ?, ?, ?, 'individual', ?, ?, 'draft', ?)
  `).run(id, 'Title', '', 'Body', channel, JSON.stringify(recipients), adminId)
  return reload(id)
}

function reload(id: string): any {
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id)
}

function hasHistory(id: string, action: string): boolean {
  const rows = getDb().prepare('SELECT * FROM message_history WHERE message_id = ? AND action = ?').all(id, action) as any[]
  return rows.length > 0
}

async function dispatchRow(row: any) {
  return dispatchMessage(getDb(), row)
}

describe('dispatchMessage — regra estrita (P1)', () => {
  it('app: confirma INSERT da notification e marca sent', async () => {
    const msg = seedMessage('app', [{ id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.success).toBe(true)
    expect(result.status).toBe('sent')
    const app = result.channels.find((c) => c.channel === 'app')
    expect(app).toMatchObject({ status: 'sent', delivered: 1 })

    const row = reload(msg.id)
    expect(row.status).toBe('sent')
    expect(row.sent_at).toBeTruthy()
    expect(row.failed_at).toBeNull()
    expect(row.error_message).toBe('')
    expect(hasHistory(msg.id, 'sent')).toBe(true)

    const notifs = getDb().prepare('SELECT * FROM notifications WHERE user_id = ?').all(passengerId) as any[]
    expect(notifs).toHaveLength(1)
  })

  it('whatsapp: falha do provedor → failed com failed_at, error_message, history e alerta', async () => {
    whatsappSend.mockRejectedValue(new Error('WhatsApp não configurado (Evolution API)'))
    const msg = seedMessage('whatsapp', [{ phone: '5511999999999' }])
    const result = await dispatchRow(msg)

    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')

    const row = reload(msg.id)
    expect(row.status).toBe('failed')
    expect(row.failed_at).toBeTruthy()
    expect(row.sent_at).toBeNull()
    expect(row.error_message).toContain('não configurado')
    expect(hasHistory(msg.id, 'failed')).toBe(true)

    const alerts = getDb().prepare("SELECT * FROM app_logs WHERE action = 'integration_error' AND description LIKE '[WhatsApp]%'").all() as any[]
    expect(alerts.length).toBeGreaterThan(0)
  })

  it('email: falha do provedor → failed com diagnóstico e alerta', async () => {
    emailSend.mockRejectedValue(new Error('Falha ao enviar email'))
    const msg = seedMessage('email', [{ email: 'dest@test.com' }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    const row = reload(msg.id)
    expect(row.status).toBe('failed')
    expect(row.failed_at).toBeTruthy()
    expect(row.error_message).toContain('Falha ao enviar email')
    expect(hasHistory(msg.id, 'failed')).toBe(true)

    const alerts = getDb().prepare("SELECT * FROM app_logs WHERE action = 'integration_error' AND description LIKE '[E-mail (Resend)]%'").all() as any[]
    expect(alerts.length).toBeGreaterThan(0)
  })

  it('push indisponível (sem VAPID): skipped → mensagem failed quando é o único canal', async () => {
    pushIsAvailable.mockReturnValue(false)
    const msg = seedMessage('push', [{ id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels.find((c) => c.channel === 'push')).toMatchObject({ status: 'skipped' })
    expect(result.reason).toContain('Nenhum destinatário elegível')
    expect(result.reason).toContain('VAPID')

    const row = reload(msg.id)
    expect(row.status).toBe('failed')
    expect(row.failed_at).toBeTruthy()
    expect(hasHistory(msg.id, 'failed')).toBe(true)
    expect(pushSendDetailed).not.toHaveBeenCalled()
  })

  it('push indisponível junto com app que entregou → sent (nenhum canal falhou)', async () => {
    pushIsAvailable.mockReturnValue(false)
    const msg = seedMessage('all', [{ id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('sent')
    expect(result.channels.find((c) => c.channel === 'push')).toMatchObject({ status: 'skipped' })
    expect(result.channels.find((c) => c.channel === 'app')).toMatchObject({ status: 'sent' })
    expect(reload(msg.id).status).toBe('sent')
  })

  it('push disponível sem subscriptions → skipped → failed quando é o único canal', async () => {
    pushIsAvailable.mockReturnValue(true)
    pushSendDetailed.mockResolvedValue({ sent: 0, total: 0, available: true })
    const msg = seedMessage('push', [{ id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels.find((c) => c.channel === 'push')).toMatchObject({ status: 'skipped' })
    expect(result.reason).toContain('nenhuma subscription')
    expect(reload(msg.id).status).toBe('failed')
  })

  it('push disponível com subscriptions mas envio todo falha → failed', async () => {
    pushIsAvailable.mockReturnValue(true)
    pushSendDetailed.mockResolvedValue({ sent: 0, total: 2, available: true })
    const msg = seedMessage('push', [{ id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    const push = result.channels.find((c) => c.channel === 'push')
    expect(push).toMatchObject({ status: 'failed', attempted: 2, delivered: 0 })
    expect(push?.detail).toContain('2 subscription')
    expect(reload(msg.id).status).toBe('failed')
    expect(hasHistory(msg.id, 'failed')).toBe(true)
  })

  it('canal sms: erro explícito, sem chamar nenhum provedor', async () => {
    const msg = seedMessage('sms', [{ phone: '5511999999999' }, { id: passengerId }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels[0]).toMatchObject({ channel: 'sms', status: 'failed' })
    expect(result.channels[0].detail).toContain('não suportado')

    const row = reload(msg.id)
    expect(row.status).toBe('failed')
    expect(row.error_message).toContain('não suportado')
    expect(whatsappSend).not.toHaveBeenCalled()
    expect(emailSend).not.toHaveBeenCalled()
    expect(pushSendDetailed).not.toHaveBeenCalled()
    expect(hasHistory(msg.id, 'failed')).toBe(true)
  })

  it('canal desconhecido: erro explícito', async () => {
    const msg = seedMessage('telegram', [])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels[0]).toMatchObject({ channel: 'telegram', status: 'failed' })
    expect(result.channels[0].detail).toContain('Canal desconhecido')
    expect(reload(msg.id).status).toBe('failed')
  })

  it('whatsapp sem destinatários com telefone: todos skipped → failed', async () => {
    const msg = seedMessage('whatsapp', [])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels.find((c) => c.channel === 'whatsapp')).toMatchObject({ status: 'skipped' })
    expect(result.reason).toContain('Nenhum destinatário elegível')
    expect(whatsappSend).not.toHaveBeenCalled()
    expect(reload(msg.id).status).toBe('failed')
    expect(hasHistory(msg.id, 'failed')).toBe(true)
  })

  it('regra estrita: app entregou mas whatsapp falhou → failed, com resumo por canal e notificação preservada', async () => {
    whatsappSend.mockRejectedValue(new Error('evolution down'))
    const msg = seedMessage('all', [{ id: passengerId, phone: '5511888888888' }])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('failed')
    expect(result.channels.find((c) => c.channel === 'app')).toMatchObject({ status: 'sent', delivered: 1 })
    expect(result.channels.find((c) => c.channel === 'whatsapp')).toMatchObject({ status: 'failed' })

    const row = reload(msg.id)
    expect(row.status).toBe('failed')
    expect(row.error_message).toContain('whatsapp')
    expect(row.error_message).toContain('app')
    expect(hasHistory(msg.id, 'failed')).toBe(true)

    const notifs = getDb().prepare('SELECT * FROM notifications WHERE user_id = ?').all(passengerId) as any[]
    expect(notifs).toHaveLength(1)
  })

  it('whatsapp parcial (1 de 2) sem outras falhas → sent com detalhe parcial', async () => {
    whatsappSend.mockImplementation(async (phone: string) => {
      if (phone === '5511000000000') throw new Error('boom')
      return { success: true, messageId: 'ok-1' }
    })
    const msg = seedMessage('whatsapp', [
      { phone: '5511111111111' },
      { phone: '5511000000000' },
    ])
    const result = await dispatchRow(msg)

    expect(result.status).toBe('sent')
    const wa = result.channels.find((c) => c.channel === 'whatsapp')
    expect(wa).toMatchObject({ status: 'sent', delivered: 1, attempted: 2 })
    expect(wa?.detail).toContain('parcial')
    expect(reload(msg.id).status).toBe('sent')
  })

  it('timeout de 10s no provedor → canal failed com diagnóstico', async () => {
    vi.useFakeTimers()
    try {
      whatsappSend.mockImplementation(() => new Promise(() => {}))
      const msg = seedMessage('whatsapp', [{ phone: '5511999999999' }])
      const promise = dispatchRow(msg)
      await vi.advanceTimersByTimeAsync(10_000)
      const result = await promise

      expect(result.status).toBe('failed')
      const row = reload(msg.id)
      expect(row.status).toBe('failed')
      expect(row.error_message).toContain('timeout')
      expect(hasHistory(msg.id, 'failed')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
