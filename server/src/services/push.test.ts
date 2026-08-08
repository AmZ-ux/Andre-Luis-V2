import { describe, it, expect, vi, afterEach } from 'vitest'

process.env.DATABASE_PATH = ':memory:'

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}))

vi.mock('web-push', () => ({
  setVapidDetails: setVapidDetailsMock,
  sendNotification: sendNotificationMock,
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
})

async function fresh() {
  vi.resetModules()
  const conn = await import('../database/connection.js')
  const schema = await import('../database/schema.js')
  await schema.runMigrations()
  const service = await import('./push.js')
  return { db: conn.getDb(), pushService: service.pushService }
}

function seedSubscriptions(db: any, entries: Record<string, any>): void {
  for (const [user, sub] of Object.entries(entries)) {
    db.prepare("INSERT INTO settings (id, category, data) VALUES (?, ?, ?)")
      .run(`id-${user}`, `push_sub_${user}`, JSON.stringify(sub))
  }
}

describe('pushService (sem VAPID)', () => {
  it('should report unavailable and send in mock mode', async () => {
    const { pushService } = await fresh()
    expect(pushService.isAvailable()).toBe(false)
    expect(await pushService.send('user-1', 'Título', 'Mensagem')).toBe(false)
  })

  it('should subscribe, update and unsubscribe', async () => {
    const { db, pushService } = await fresh()
    const sub = { endpoint: 'https://push.example.com/e1', keys: { p256dh: 'k1', auth: 'a1' } }
    await pushService.subscribe('user-1', sub)
    let row = db.prepare("SELECT data FROM settings WHERE category = 'push_sub_user-1'").get() as any
    expect(JSON.parse(row.data).endpoint).toBe('https://push.example.com/e1')

    await pushService.subscribe('user-1', { endpoint: 'https://push.example.com/e2', keys: { p256dh: 'k2', auth: 'a2' } })
    row = db.prepare("SELECT data FROM settings WHERE category = 'push_sub_user-1'").get() as any
    expect(JSON.parse(row.data).endpoint).toBe('https://push.example.com/e2')

    await pushService.unsubscribe('user-1')
    expect(db.prepare("SELECT 1 FROM settings WHERE category = 'push_sub_user-1'").get()).toBeUndefined()
  })

  it('should sendToAll count subscriptions even without webPush', async () => {
    const { db, pushService } = await fresh()
    seedSubscriptions(db, {
      u1: { endpoint: 'https://p/u1', keys: { p256dh: 'k', auth: 'a' } },
      u2: { endpoint: 'https://p/u2', keys: { p256dh: 'k', auth: 'a' } },
    })
    const count = await pushService.sendToAll('Título', 'Mensagem')
    expect(count).toBe(2)
  })
})

describe('pushService (com VAPID)', () => {
  it('should send a real notification and remove expired subscriptions', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub-key'
    process.env.VAPID_PRIVATE_KEY = 'priv-key'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockResolvedValueOnce({}).mockRejectedValueOnce({ statusCode: 410 })

    const { db, pushService } = await fresh()
    expect(pushService.isAvailable()).toBe(true)
    expect(setVapidDetailsMock).toHaveBeenCalled()

    seedSubscriptions(db, {
      ok: { endpoint: 'https://p/ok', keys: { p256dh: 'k', auth: 'a' } },
      gone: { endpoint: 'https://p/gone', keys: { p256dh: 'k', auth: 'a' } },
    })

    expect(await pushService.send('ok', 'Título', 'Mensagem', { link: '/x' })).toBe(true)
    expect(JSON.parse(sendNotificationMock.mock.calls[0][1])).toEqual({ title: 'Título', body: 'Mensagem', link: '/x' })

    expect(await pushService.send('gone', 'Título', 'Mensagem')).toBe(false)
    expect(db.prepare("SELECT 1 FROM settings WHERE category = 'push_sub_gone'").get()).toBeUndefined()
  })
})
