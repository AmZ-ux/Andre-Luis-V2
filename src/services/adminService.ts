import { config } from '../config'
import { realAdmin, type AdminUser } from './realApi'

export type { AdminUser } from './realApi'

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const adminService = {
  async list(): Promise<AdminUser[]> {
    if (config.realApi) return realAdmin.list()
    await delay(400)
    return []
  },

  async create(data: { name: string; email: string; password: string }): Promise<AdminUser> {
    if (config.realApi) return realAdmin.create(data)
    await delay(400)
    throw new Error('Disponível apenas com a API real')
  },

  async promote(userId: string): Promise<void> {
    if (config.realApi) {
      await realAdmin.promote(userId)
      return
    }
    await delay(400)
    throw new Error('Disponível apenas com a API real')
  },

  async demote(userId: string): Promise<void> {
    if (config.realApi) {
      await realAdmin.demote(userId)
      return
    }
    await delay(400)
    throw new Error('Disponível apenas com a API real')
  },
}
