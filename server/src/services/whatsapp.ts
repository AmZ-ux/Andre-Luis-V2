import { logger } from '../utils/logger.js'
import { getDb } from '../database/connection.js'

interface WhatsAppProvider {
  send(to: string, message: string): Promise<{ success: boolean; messageId?: string }>
}

class TwilioProvider implements WhatsAppProvider {
  async send(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_NUMBER

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio não configurado. Defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_NUMBER')
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: message }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Twilio error: ${err}`)
    }

    const data = await res.json() as any
    return { success: true, messageId: data.sid }
  }
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
    provider = process.env.TWILIO_ACCOUNT_SID ? new TwilioProvider() : new MockProvider()
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
