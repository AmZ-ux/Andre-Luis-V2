import { describe, it, expect, vi, afterEach } from 'vitest'

process.env.DATABASE_PATH = ':memory:'

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
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

function seedSub(db: any, userId: string, endpoint: string, p256dh = 'k', auth = 'a'): string {
  let hash = 0
  for (let i = 0; i < endpoint.length; i++) {
    hash = ((hash << 5) - hash + endpoint.charCodeAt(i)) | 0
  }
  const h = Math.abs(hash).toString(36).padStart(8, '0')
  const key = `push_sub_${userId}_${h}`
  db.prepare("INSERT INTO settings (id, category, data) VALUES (?, ?, ?)")
    .run(`id-${userId}-${h}`, key, JSON.stringify({ endpoint, keys: { p256dh, auth } }))
  return key
}

function countSubs(db: any, userId: string): number {
  const rows = db.prepare(`SELECT category FROM settings WHERE category LIKE 'push_sub_${userId}_%'`).all()
  return rows.length
}

function getSubKeys(db: any, userId: string): string[] {
  return db.prepare(`SELECT category FROM settings WHERE category LIKE 'push_sub_${userId}_%'`).all().map((r: any) => r.category)
}

// ─── ETAPA 2: MODELO DE DADOS ───────────────────────────────────

describe('ETAPA 2: Modelo de dados', () => {
  it('mesmo userId + mesmo endpoint → update, sem duplicar', async () => {
    const { db, pushService } = await fresh()
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/aaa', keys: { p256dh: 'k1', auth: 'a1' } }

    await pushService.subscribe('user-A', sub)
    expect(countSubs(db, 'user-A')).toBe(1)

    await pushService.subscribe('user-A', { ...sub, keys: { p256dh: 'k2', auth: 'a2' } })
    expect(countSubs(db, 'user-A')).toBe(1)

    const data = JSON.parse(db.prepare("SELECT data FROM settings WHERE category LIKE 'push_sub_user-A_%'").get().data)
    expect(data.keys.p256dh).toBe('k2')
  })

  it('mesmo userId + endpoint diferente → segunda subscription', async () => {
    const { db, pushService } = await fresh()

    await pushService.subscribe('user-A', { endpoint: 'https://fcm.googleapis.com/fcm/send/aaa', keys: { p256dh: 'k1', auth: 'a1' } })
    await pushService.subscribe('user-A', { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/bbb', keys: { p256dh: 'k2', auth: 'a2' } })

    expect(countSubs(db, 'user-A')).toBe(2)
  })

  it('userId diferente → completamente isolado', async () => {
    const { db, pushService } = await fresh()

    await pushService.subscribe('user-A', { endpoint: 'https://fcm.googleapis.com/fcm/send/aaa', keys: { p256dh: 'k1', auth: 'a1' } })
    await pushService.subscribe('user-B', { endpoint: 'https://fcm.googleapis.com/fcm/send/bbb', keys: { p256dh: 'k2', auth: 'a2' } })

    expect(countSubs(db, 'user-A')).toBe(1)
    expect(countSubs(db, 'user-B')).toBe(1)

    const keysA = getSubKeys(db, 'user-A')
    const keysB = getSubKeys(db, 'user-B')
    expect(keysA[0]).not.toBe(keysB[0])
  })

  it('unsubscribe user-A não afeta user-B', async () => {
    const { db, pushService } = await fresh()

    await pushService.subscribe('user-A', { endpoint: 'https://fcm.googleapis.com/fcm/send/aaa', keys: { p256dh: 'k1', auth: 'a1' } })
    await pushService.subscribe('user-B', { endpoint: 'https://fcm.googleapis.com/fcm/send/bbb', keys: { p256dh: 'k2', auth: 'a2' } })

    await pushService.unsubscribe('user-A')
    expect(countSubs(db, 'user-A')).toBe(0)
    expect(countSubs(db, 'user-B')).toBe(1)
  })

  it('hash gera strings determinísticas e longas o suficiente', () => {
    const endpoints = [
      'https://fcm.googleapis.com/fcm/send/aaa111',
      'https://updates.push.services.mozilla.com/wpush/v2/bbb222',
      'https://fcm.googleapis.com/fcm/send/aaa112',
      'https://wns2-atm.blue.zinc.wns.windows.com/abc',
    ]
    const hashes = endpoints.map((ep) => {
      let hash = 0
      for (let i = 0; i < ep.length; i++) {
        hash = ((hash << 5) - hash + ep.charCodeAt(i)) | 0
      }
      return Math.abs(hash).toString(36).padStart(8, '0')
    })

    expect(hashes.every((h) => h.length >= 8)).toBe(true)
    expect(new Set(hashes).size).toBe(endpoints.length)
  })
})

// ─── ETAPA 3: VALIDAR send(userId) ──────────────────────────────

describe('ETAPA 3: send(userId)', () => {
  it('0 subscriptions → sent = 0', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    const { pushService } = await fresh()
    expect(await pushService.send('nobody', 'Title', 'Body')).toBe(0)
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })

  it('1 subscription válida → sent = 1, sendNotification chamado 1x', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockResolvedValue({})

    const { db, pushService } = await fresh()
    seedSub(db, 'user-1', 'https://p/1')

    const sent = await pushService.send('user-1', 'Title', 'Body')

    expect(sent).toBe(1)
    expect(sendNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendNotificationMock.mock.calls[0][0]).toEqual({ endpoint: 'https://p/1', keys: { p256dh: 'k', auth: 'a' } })
    expect(JSON.parse(sendNotificationMock.mock.calls[0][1])).toEqual({ title: 'Title', body: 'Body' })
  })

  it('2 subscriptions válidas → sendNotification chamado 2x, sent = 2', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockResolvedValue({})

    const { db, pushService } = await fresh()
    seedSub(db, 'user-multi', 'https://p/chrome-1')
    seedSub(db, 'user-multi', 'https://p/firefox-1')

    const sent = await pushService.send('user-multi', 'Title', 'Body')

    expect(sent).toBe(2)
    expect(sendNotificationMock).toHaveBeenCalledTimes(2)
  })

  it('1 válida + 1 falha (não-410) → válida continua, sent = 1', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ statusCode: 500, message: 'Server error' })

    const { db, pushService } = await fresh()
    seedSub(db, 'user-mixed', 'https://p/ok')
    seedSub(db, 'user-mixed', 'https://p/fail')

    const sent = await pushService.send('user-mixed', 'Title', 'Body')

    expect(sent).toBe(1)
    expect(sendNotificationMock).toHaveBeenCalledTimes(2)
    expect(countSubs(db, 'user-mixed')).toBe(2)
  })

  it('1 válida + 1 network error (statusCode=0) → ambas existem, sent = 0 ou 1', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 0, message: 'Network error' })
      .mockResolvedValueOnce({})

    const { db, pushService } = await fresh()
    seedSub(db, 'user-neterr', 'https://p/first')
    seedSub(db, 'user-neterr', 'https://p/second')

    const sent = await pushService.send('user-neterr', 'Title', 'Body')

    expect(sent).toBe(1)
    expect(countSubs(db, 'user-neterr')).toBe(2)
  })

  it('sem VAPID keys → sent = 0, sendNotification não chamado', async () => {
    const { pushService } = await fresh()
    sendNotificationMock.mockReset()
    const sent = await pushService.send('user-1', 'Title', 'Body')
    expect(sent).toBe(0)
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })
})

// ─── ETAPA 4: 410 E CLEANUP ─────────────────────────────────────

describe('ETAPA 4: 410 e cleanup', () => {
  it('A retorna 410, B retorna sucesso → A removida, B continua', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({})

    const { db, pushService } = await fresh()
    seedSub(db, 'user-410', 'https://p/expired-A')
    seedSub(db, 'user-410', 'https://p/valid-B')

    expect(countSubs(db, 'user-410')).toBe(2)

    const sent = await pushService.send('user-410', 'Title', 'Body')

    expect(sent).toBe(1)
    expect(countSubs(db, 'user-410')).toBe(1)

    const remainingData = JSON.parse(db.prepare("SELECT data FROM settings WHERE category LIKE 'push_sub_user-410_%'").get().data)
    expect(remainingData.endpoint).toBe('https://p/valid-B')
  })

  it('network error (statusCode=0) não remove subscription', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockRejectedValue({ statusCode: 0, message: 'ECONNREFUSED' })

    const { db, pushService } = await fresh()
    seedSub(db, 'user-net', 'https://p/sub1')

    await pushService.send('user-net', 'Title', 'Body')
    expect(countSubs(db, 'user-net')).toBe(1)
  })

  it('sendToAll: A retorna 410, B retorna sucesso → A removida, B continua', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({})

    const { db, pushService } = await fresh()
    seedSub(db, 'userX', 'https://p/expired-X')
    seedSub(db, 'userY', 'https://p/valid-Y')

    const sent = await pushService.sendToAll('Title', 'Body')
    expect(sent).toBe(1)
    expect(countSubs(db, 'userX')).toBe(0)
    expect(countSubs(db, 'userY')).toBe(1)
  })
})

// ─── ETAPA 5: sendToAll() ────────────────────────────────────────

describe('ETAPA 5: sendToAll()', () => {
  it('User A (2 subs) + User B (1 sub) + User C (0 subs) → 3 sent', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockResolvedValue({})

    const { db, pushService } = await fresh()
    seedSub(db, 'userA', 'https://p/a1')
    seedSub(db, 'userA', 'https://p/a2')
    seedSub(db, 'userB', 'https://p/b1')

    const sent = await pushService.sendToAll('Title', 'Body')
    expect(sent).toBe(3)
    expect(sendNotificationMock).toHaveBeenCalledTimes(3)
  })

  it('subscription inválida não bloqueia as outras', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const { db, pushService } = await fresh()
    seedSub(db, 'userA', 'https://p/expired')
    seedSub(db, 'userB', 'https://p/ok1')
    seedSub(db, 'userC', 'https://p/ok2')

    const sent = await pushService.sendToAll('Title', 'Body')
    expect(sent).toBe(2)
  })

  it('sem webPush → contabiliza todas como sent (mocked count)', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-nw', 'https://p/s1')
    seedSub(db, 'user-nw', 'https://p/s2')
    const sent = await pushService.sendToAll('Title', 'Body')
    expect(sent).toBe(2)
  })

  it('nenhum catch silencioso esconde erro — log chama logger.error', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'
    process.env.VAPID_PRIVATE_KEY = 'priv'
    sendNotificationMock.mockReset()
    sendNotificationMock.mockRejectedValue({ statusCode: 503, message: 'Unavailable' })

    const { db, pushService } = await fresh()
    seedSub(db, 'user-err', 'https://p/fail')

    const sent = await pushService.sendToAll('Title', 'Body')
    expect(sent).toBe(0)
    expect(sendNotificationMock).toHaveBeenCalledTimes(1)
  })
})

// ─── ETAPA 6: UNSUBSCRIBE ───────────────────────────────────────

describe('ETAPA 6: unsubscribe()', () => {
  it('remove TODAS as subscriptions do userId (LIKE prefix%)', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-u', 'https://p/chrome')
    seedSub(db, 'user-u', 'https://p/firefox')
    seedSub(db, 'user-u', 'https://p/android')

    expect(countSubs(db, 'user-u')).toBe(3)
    await pushService.unsubscribe('user-u')
    expect(countSubs(db, 'user-u')).toBe(0)
  })

  it('com endpoint: remove SOMENTE a subscription daquele endpoint', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-targeted', 'https://p/chrome')
    seedSub(db, 'user-targeted', 'https://p/firefox')

    expect(countSubs(db, 'user-targeted')).toBe(2)

    await pushService.unsubscribe('user-targeted', 'https://p/firefox')

    expect(countSubs(db, 'user-targeted')).toBe(1)
    const remaining = JSON.parse(db.prepare("SELECT data FROM settings WHERE category LIKE 'push_sub_user-targeted_%'").get().data)
    expect(remaining.endpoint).toBe('https://p/chrome')
  })

  it('com endpoint inexistente: não deleta nada', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-noop', 'https://p/chrome')

    await pushService.unsubscribe('user-noop', 'https://p/nonexistent')
    expect(countSubs(db, 'user-noop')).toBe(1)
  })

  it('não afeta subscriptions de outros usuários', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-u1', 'https://p/c1')
    seedSub(db, 'user-u2', 'https://p/c2')

    await pushService.unsubscribe('user-u1')
    expect(countSubs(db, 'user-u1')).toBe(0)
    expect(countSubs(db, 'user-u2')).toBe(1)
  })

  it('unsubscribe em userId sem subscriptions não causa erro', async () => {
    const { pushService } = await fresh()
    await pushService.unsubscribe('nonexistent')
  })
})

// ─── ANÁLISE: RISCO UNSUBSCRIBE MULTI-DEVICE ────────────────────

describe('ANÁLISE: unsubscribe multi-device', () => {
  it('sem endpoint: remove Chrome + Firefox do mesmo user (backward compat)', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-both', 'https://fcm.googleapis.com/fcm/send/chrome-endpoint')
    seedSub(db, 'user-both', 'https://updates.push.services.mozilla.com/wpush/v2/firefox-endpoint')

    expect(countSubs(db, 'user-both')).toBe(2)
    await pushService.unsubscribe('user-both')
    expect(countSubs(db, 'user-both')).toBe(0)
  })

  it('com endpoint: remove só o browser atual, preserva o outro', async () => {
    const { db, pushService } = await fresh()
    seedSub(db, 'user-both2', 'https://fcm.googleapis.com/fcm/send/chrome-endpoint')
    seedSub(db, 'user-both2', 'https://updates.push.services.mozilla.com/wpush/v2/firefox-endpoint')

    expect(countSubs(db, 'user-both2')).toBe(2)
    await pushService.unsubscribe('user-both2', 'https://updates.push.services.mozilla.com/wpush/v2/firefox-endpoint')
    expect(countSubs(db, 'user-both2')).toBe(1)

    const remaining = JSON.parse(db.prepare("SELECT data FROM settings WHERE category LIKE 'push_sub_user-both2_%'").get().data)
    expect(remaining.endpoint).toBe('https://fcm.googleapis.com/fcm/send/chrome-endpoint')
  })
})
