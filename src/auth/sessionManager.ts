import { storage } from '../services/storage'
import { config } from '../config'
import { SESSION_CONFIG } from '../constants/permissions'
import type { User } from '../types/auth'
import { realAuth } from '../services/realApi'

export interface SessionData {
  user: User
  token: string
  expiresAt: number
}

export const sessionManager = {
  save(data: SessionData, _rememberMe: boolean): void {
    storage.set(SESSION_CONFIG.storageKey, {
      token: data.token,
      expiresAt: data.expiresAt,
    })
    storage.set(SESSION_CONFIG.userKey, data.user)
  },

  load(): SessionData | null {
    const session = storage.get<{ token: string; expiresAt: number }>(
      SESSION_CONFIG.storageKey
    )
    const user = storage.get<User>(SESSION_CONFIG.userKey)
    if (!session || !user) return null
    return { user, token: session.token, expiresAt: session.expiresAt }
  },

  isValid(): boolean {
    const session = storage.get<{ token: string; expiresAt: number }>(
      SESSION_CONFIG.storageKey
    )
    if (!session) return false
    return Date.now() < session.expiresAt
  },

  getTimeRemaining(): number {
    const session = storage.get<{ token: string; expiresAt: number }>(
      SESSION_CONFIG.storageKey
    )
    if (!session) return 0
    return Math.max(0, session.expiresAt - Date.now())
  },

  shouldRenew(): boolean {
    const remaining = this.getTimeRemaining()
    return remaining > 0 && remaining < SESSION_CONFIG.renewalThresholdMs
  },

  async renew(): Promise<boolean> {
    if (config.realApi) {
      try {
        const { token, expiresAt } = await realAuth.refresh()
        const session = this.load()
        if (session) {
          this.save({ ...session, token, expiresAt }, true)
          return true
        }
      } catch {
        return false
      }
    }

    const session = storage.get<{ token: string; expiresAt: number }>(
      SESSION_CONFIG.storageKey
    )
    if (!session) return false
    session.expiresAt = Date.now() + SESSION_CONFIG.defaultExpiryMs
    storage.set(SESSION_CONFIG.storageKey, session)
    return true
  },

  destroy(): void {
    storage.remove(SESSION_CONFIG.storageKey)
    storage.remove(SESSION_CONFIG.userKey)
  },
}
