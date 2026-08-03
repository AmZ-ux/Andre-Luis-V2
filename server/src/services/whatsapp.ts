import { logger } from '../utils/logger.js'
import { getDb } from '../database/connection.js'

interface WhatsAppProvider {
  send(to: string, message: string): Promise<{ success: boolean; messageId?: string }>
}

// Evolution API (self-hosted) — envia via instancia conectada por QRCode.
// Requer EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.
class EvolutionProvider implements WhatsAppProvider {
  private baseUrl: string
  private apiKey: string
  private instance: string

  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || ''
    this.apiKey = process.env.EVOLUTION_API_KEY || ''
    this.instance = process.env.EVOLUTION_INSTANCE || ''

    if (!this.baseUrl || !this.apiKey || !this.instance) {
      throw new Error('Evolution API não configurado. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE')
    }
    this.baseUrl = this.baseUrl.replace(/\/+$/, '')
  }

  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const number = to.replace(/[^\d]/g, '')
    const res = await fetch(`${this.baseUrl}/message/sendText/${this.instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: JSON.stringify({ number, text: message }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Evolution error ${res.status}: ${err}`)
    }

    const data = await res.json() as any
    return { success: true, messageId: data?.key?.id || data?.messageId || `evolution-${Date.now()}` }
  }
}

// Evolution em modo silencioso: registra apenas a intenção de envio (sem chamar a API).
function evolutionConfigured(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE)
}

class MockProvider implements WhatsAppProvider {
  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    logger.info({ to, preview: message.substring(0, 50) }, 'WhatsApp mock sent')
    return { success: true, messageId: `mock-${Date.now()}` }
  }
}

let provider: WhatsAppProvider

function getProvider(): WhatsAppProvider {
  if (!provider) {
    provider = evolutionConfigured() ? new EvolutionProvider() : new MockProvider()
  }
  return provider
}

export const whatsappService = {
  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const result = await getProvider().send(to, message)

    const db = getDb()
    db.prepare(`
      INSERT INTO messages (id, title, body, type, channel, recipients, created_by)
      VALUES (?, ?, ?, 'individual', 'whatsapp', ?, 'system')
    `).run(
      crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      `WhatsApp para ${to}`,
      message,
      JSON.stringify([to])
    )

    return result
  },

  async sendBulk(recipients: { phone: string; name: string }[], messageTemplate: string): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0
    for (const r of recipients) {
      try {
        const personalizedMsg = messageTemplate.replace(/{nome}/g, r.name)
        await this.send(r.phone, personalizedMsg)
        sent++
      } catch {
        failed++
      }
    }
    return { sent, failed }
  },
}