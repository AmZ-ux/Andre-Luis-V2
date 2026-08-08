import { v4 as uuid } from 'uuid'
import { logger } from '../utils/logger.js'

// Alerta de integracao: notifica os administradores sobre falhas em servicos
// externos (Mercado Pago, Resend, Evolution API, push) para acao manual.
export function alertIntegrationIssue(db: any, service: string, message: string): void {
  try {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as any[]
    if (admins.length === 0) return
    for (const admin of admins) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, type, status)
        VALUES (?, ?, ?, ?, 'warning', 'unread')
      `).run(uuid(), admin.id, `Falha de integração: ${service}`, message)
    }
    db.prepare(`
      INSERT INTO app_logs (id, action, description, user_name, user_role, category)
      VALUES (?, 'integration_error', ?, 'system', 'admin', 'integration')
    `).run(uuid(), `[${service}] ${message}`)
    logger.warn({ service, message }, 'Integration alert sent to admins')
  } catch (err) {
    logger.error({ err, service }, 'Failed to send integration alert')
  }
}
