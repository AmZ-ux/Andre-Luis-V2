import { logger } from '../utils/logger.js'

export function emailDisabled(): boolean {
  return process.env.EMAIL_DISABLED === 'true'
}

export function emailConfigured(): boolean {
  return !emailDisabled() && !!process.env.RESEND_API_KEY
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (emailDisabled()) {
    logger.info({ to, subject }, 'EMAIL_DISABLED — email would be sent (demo mode)')
    return
  }
  if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
    throw new Error('Envio de email não configurado (RESEND_API_KEY ausente)')
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.info({ to, subject }, 'Resend not configured — email would be sent (dev mode)')
    return
  }
  const from = process.env.RESEND_FROM || 'Transporte André Luis <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    logger.error({ error: await res.text() }, 'Resend send failed')
    throw new Error('Falha ao enviar email')
  }
}
