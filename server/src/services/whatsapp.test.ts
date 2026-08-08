import { describe, it, expect, vi, afterEach } from 'vitest'

process.env.DATABASE_PATH = ':memory:'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  delete process.env.EVOLUTION_API_URL
  delete process.env.EVOLUTION_API_KEY
  delete process.env.EVOLUTION_INSTANCE
})

async function fresh() {
  vi.resetModules()
  const conn = await import('../database/connection.js')
  const schema = await import('../database/schema.js')
  await schema.runMigrations()
  const service = await import('./whatsapp.js')
  return { db: conn.getDb(), whatsappService: service.whatsappService }
}

describe('whatsappService (sem Evolution API)', () => {
  it('should send in mock mode and record the message', async () => {
    const { db, whatsappService } = await fresh()
    const result = await whatsappService.send('(11) 99999-1234', 'Olá {nome}!')
    expect(result.success).toBe(true)
    expect(result.messageId).toContain('mock-')
    const rows = db.prepare("SELECT * FROM messages WHERE channel = 'whatsapp'").all()
    expect(rows.length).toBe(1)
    expect(JSON.parse(rows[0].recipients)[0]).toBe('(11) 99999-1234')
  })

  it('should sendBulk with personalized names', async () => {
    const { db, whatsappService } = await fresh()
    const result = await whatsappService.sendBulk(
      [{ phone: '(11) 11111-1111', name: 'Ana' }, { phone: '(11) 22222-2222', name: 'Bruno' }],
      'Olá {nome}, sua mensalidade venceu!'
    )
    expect(result).toEqual({ sent: 2, failed: 0 })
    const rows = db.prepare("SELECT * FROM messages WHERE channel = 'whatsapp'").all()
    expect(rows.length).toBe(2)
    expect(rows.map((r: any) => JSON.parse(r.recipients)[0]))
      .toEqual(['(11) 11111-1111', '(11) 22222-2222'])
  })
})

describe('whatsappService (com Evolution API)', () => {
  it('should call the Evolution API with sanitized number', async () => {
    process.env.EVOLUTION_API_URL = 'https://evo.example.com/'
    process.env.EVOLUTION_API_KEY = 'secret-key'
    process.env.EVOLUTION_INSTANCE = 'instancia-1'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ key: { id: 'MSG-1' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { db, whatsappService } = await fresh()
    const result = await whatsappService.send('(11) 99999-1234', 'Olá!')
    expect(result.success).toBe(true)
    expect(result.messageId).toBe('MSG-1')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://evo.example.com/message/sendText/instancia-1')
    expect(options.headers.apikey).toBe('secret-key')
    expect(JSON.parse(options.body)).toEqual({ number: '11999991234', text: 'Olá!' })
    expect(db.prepare("SELECT 1 FROM messages WHERE channel = 'whatsapp'").get()).toBeTruthy()
  })

  it('should throw when the Evolution API returns an error', async () => {
    process.env.EVOLUTION_API_URL = 'https://evo.example.com'
    process.env.EVOLUTION_API_KEY = 'secret-key'
    process.env.EVOLUTION_INSTANCE = 'instancia-1'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('bad request'),
    }))
    const { whatsappService } = await fresh()
    await expect(whatsappService.send('11999991234', 'Olá')).rejects.toThrow('Evolution error 400')
  })

  it('should count failures in sendBulk when send throws', async () => {
    process.env.EVOLUTION_API_URL = 'https://evo.example.com'
    process.env.EVOLUTION_API_KEY = 'secret-key'
    process.env.EVOLUTION_INSTANCE = 'instancia-1'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { whatsappService } = await fresh()
    const result = await whatsappService.sendBulk(
      [{ phone: '11999990000', name: 'Ana' }, { phone: '11999990001', name: 'Bruno' }],
      'Olá {nome}'
    )
    expect(result).toEqual({ sent: 0, failed: 2 })
  })
})
