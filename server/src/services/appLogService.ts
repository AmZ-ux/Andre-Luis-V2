import { v4 as uuid } from 'uuid'
import type { DatabaseWrapper } from '../database/connection.js'

export function addLog(db: DatabaseWrapper, action: string, description: string, user: { userId: string; role: string }, category = 'general'): void {
  db.prepare('INSERT INTO app_logs (id, action, description, user_name, user_role, category) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), action, description, user.role === 'admin' ? 'Administrador' : 'Passageiro', user.role, category)
}
