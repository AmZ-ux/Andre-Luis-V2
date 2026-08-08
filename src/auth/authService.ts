import type { User, AuthResponse, LoginCredentials, RegisterCredentials } from '../types/auth'
import { storage } from '../services/storage'
import { config } from '../config'
import { realAuth } from '../services/realApi'
import { passengerService } from '../services/passengerService'
import { monthlyFeeService } from '../services/monthlyFeeService'
import { SESSION_CONFIG } from '../constants/permissions'
import { formatCPF } from '../validators/passengerValidators'

const DEFAULT_USERS: User[] = [
  {
    id: '1',
    name: 'André Luis',
    email: 'admin@transporte.com',
    cpf: '000.000.000-00',
    phone: '(11) 99999-8888',
    role: 'admin',
    createdAt: '01/01/2026',
    lastAccess: new Date().toLocaleString('pt-BR'),
  },
  {
    id: '2',
    name: 'Maria Oliveira',
    email: 'passageiro@transporte.com',
    cpf: '111.111.111-11',
    phone: '(11) 99999-7777',
    role: 'passenger',
    createdAt: '15/03/2026',
    lastAccess: new Date().toLocaleString('pt-BR'),
  },
]

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'transporte-salt-2026')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function seedUsers(): void {
  const existing = storage.get<User[]>(SESSION_CONFIG.userListKey)
  if (existing) return

  const seed = async () => {
    const usersWithHash = await Promise.all(
      DEFAULT_USERS.map(async (u) => ({
        ...u,
        passwordHash: await hashPassword(u.email === 'admin@transporte.com' ? 'Admin@123' : 'Pass@123'),
      }))
    )
    storage.set(SESSION_CONFIG.userListKey, usersWithHash)
  }
  seed()
}

seedUsers()

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    if (config.realApi) {
      const response = await realAuth.login(credentials)
      return response
    }

    await delay(1200)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find(
      (u) => u.email === credentials.login || u.cpf === credentials.login
    )

    if (!user) {
      throw new Error('Credenciais inválidas')
    }

    const hash = await hashPassword(credentials.password)
    if (hash !== user.passwordHash) {
      throw new Error('Credenciais inválidas')
    }

    const expiryMs = credentials.rememberMe
      ? SESSION_CONFIG.rememberMeExpiryMs
      : SESSION_CONFIG.defaultExpiryMs

    const expiresAt = Date.now() + expiryMs
    const token = await hashPassword(`${user.id}-${expiresAt}-${Math.random()}`)

    user.lastAccess = new Date().toLocaleString('pt-BR')
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, lastAccess: user.lastAccess } : u
    )
    storage.set(SESSION_CONFIG.userListKey, updatedUsers)

    const { passwordHash: _, ...safeUser } = user

    return {
      user: { ...safeUser, lastAccess: user.lastAccess },
      token,
      expiresAt,
    }
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    if (config.realApi) {
      return realAuth.register(credentials)
    }

    await delay(1000)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const email = credentials.email.trim().toLowerCase()
    const cpf = credentials.cpf.replace(/\D/g, '')

    if (users.some((u) => u.email.toLowerCase() === email || u.cpf.replace(/\D/g, '') === cpf)) {
      throw new Error('Já existe uma conta cadastrada com este email ou CPF')
    }

    const id = `u-${Date.now()}`
    const user: User & { passwordHash: string } = {
      id,
      name: credentials.name.trim(),
      email,
      cpf: formatCPF(credentials.cpf),
      phone: credentials.phone,
      role: 'passenger',
      passwordHash: await hashPassword(credentials.password),
      createdAt: new Date().toLocaleDateString('pt-BR'),
      lastAccess: new Date().toLocaleString('pt-BR'),
    }

    users.push(user)
    storage.set(SESSION_CONFIG.userListKey, users)

    const dueDay = (() => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(credentials.contractStartDate)
      return match ? Number(match[3]) : 5
    })()
    const monthlyFee = Number(String(credentials.monthlyFee || '').replace(',', '.')) || 0

    await passengerService.create(
      {
        name: user.name,
        cpf: user.cpf,
        rg: '',
        birthDate: '01/01/2000',
        phone: user.phone,
        whatsapp: '',
        email: user.email,
        address: {
          zipCode: '',
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          city: '',
          state: '',
        },
        transportType: credentials.transportType,
        monthlyFee,
        dueDay,
        paymentMethod: 'pix',
        status: 'active',
        pickupPoint: credentials.pickupPoint,
        destination: credentials.destination,
        contractStartDate: credentials.contractStartDate,
        notes: '',
      },
      { id }
    )

    // Primeira mensalidade: competencia do mes atual (mes do cadastro)
    const now = new Date()
    const feeMonth = now.getMonth() + 1
    const feeYear = now.getFullYear()
    await monthlyFeeService.create({
      passengerId: user.id,
      passengerName: user.name,
      cpf: user.cpf,
      transportType: credentials.transportType,
      institution: undefined,
      company: undefined,
      month: feeMonth,
      year: feeYear,
      amount: monthlyFee,
      dueDay,
    })

    const { passwordHash: _, ...safeUser } = user
    const token = await hashPassword(`${id}-${Date.now()}-${Math.random()}`)

    return {
      user: safeUser,
      token,
      expiresAt: Date.now() + SESSION_CONFIG.defaultExpiryMs,
    }
  },

  async forgotPassword(email: string): Promise<{ token: string; message: string }> {
    if (config.realApi) {
      return realAuth.forgotPassword(email)
    }

    await delay(1000)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find((u) => u.email === email)

    if (!user) {
      await delay(500)
    }

    const resetToken = Math.random().toString(36).substring(2, 15)
    storage.set('reset_token_' + resetToken, { email, expiresAt: Date.now() + 3600000 })

    return {
      token: resetToken,
      message: 'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.',
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (config.realApi) {
      await realAuth.resetPassword(token, newPassword)
      return
    }

    await delay(1000)

    const resetData = storage.get<{ email: string; expiresAt: number }>('reset_token_' + token)
    if (!resetData) {
      throw new Error('Token inválido ou expirado')
    }

    if (Date.now() > resetData.expiresAt) {
      storage.remove('reset_token_' + token)
      throw new Error('Token expirado. Solicite uma nova recuperação de senha.')
    }

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const updatedUsers = await Promise.all(
      users.map(async (u) =>
        u.email === resetData.email
          ? { ...u, passwordHash: await hashPassword(newPassword) }
          : u
      )
    )

    storage.set(SESSION_CONFIG.userListKey, updatedUsers)
    storage.remove('reset_token_' + token)
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (config.realApi) {
      await realAuth.changePassword({ currentPassword, newPassword })
      return
    }

    await delay(800)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find((u) => u.id === userId)

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const currentHash = await hashPassword(currentPassword)
    if (currentHash !== user.passwordHash) {
      throw new Error('Senha atual incorreta')
    }

    const newHash = await hashPassword(newPassword)
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, passwordHash: newHash } : u
    )

    storage.set(SESSION_CONFIG.userListKey, updatedUsers)
  },

  async endContract(userId: string): Promise<void> {
    if (config.realApi) {
      await realAuth.endContract()
      return
    }

    await delay(600)

    const passenger = await passengerService.getById(userId)
    if (!passenger) {
      throw new Error('Passageiro não encontrado')
    }
    if (passenger.status === 'inactive') {
      throw new Error('Seu contrato já está encerrado')
    }
    await passengerService.update(userId, { status: 'inactive' })
  },

  async getProfile(userId: string): Promise<User> {
    if (config.realApi) {
      return realAuth.me()
    }

    await delay(300)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find((u) => u.id === userId)

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    let contractStatus: User['contractStatus']
    if (user.role === 'passenger') {
      const passenger = await passengerService.getById(userId)
      contractStatus = passenger?.status
    }

    const { passwordHash: _, ...safeUser } = user
    return contractStatus ? { ...safeUser, contractStatus } : safeUser
  },

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; email?: string }
  ): Promise<User> {
    if (config.realApi) {
      await realAuth.updateProfile(data)
      return realAuth.me()
    }

    await delay(600)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find((u) => u.id === userId)

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase()
      if (users.some((u) => u.id !== userId && u.email.toLowerCase() === email)) {
        throw new Error('Email já está em uso')
      }
      data.email = email
    }

    const updated: User & { passwordHash: string } = {
      ...user,
      name: data.name !== undefined ? data.name.trim() : user.name,
      phone: data.phone !== undefined ? data.phone.trim() : user.phone,
      email: data.email !== undefined ? data.email : user.email,
      emailVerified: data.email !== undefined ? false : user.emailVerified,
    }

    const updatedUsers = users.map((u) => (u.id === userId ? updated : u))
    storage.set(SESSION_CONFIG.userListKey, updatedUsers)

    if (data.email !== undefined || data.name !== undefined || data.phone !== undefined) {
      try {
        const passenger = await passengerService.getById(userId)
        if (passenger) {
          await passengerService.update(userId, {
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
          })
        }
      } catch {}
    }

    const { passwordHash: _, ...safeUser } = updated
    return safeUser
  },

  async sendVerificationEmail(userId: string): Promise<{ demoCode?: string }> {
    if (config.realApi) {
      return realAuth.sendVerificationEmail()
    }

    await delay(600)

    const code = String(Math.floor(100000 + Math.random() * 900000))
    storage.set(`verify_code_${userId}`, { code, expiresAt: Date.now() + 30 * 60 * 1000 })
    return { demoCode: code }
  },

  async confirmVerificationEmail(userId: string, code: string): Promise<User> {
    if (config.realApi) {
      await realAuth.confirmVerificationEmail(code)
      return realAuth.me()
    }

    await delay(600)

    const users = storage.get<(User & { passwordHash: string })[]>(SESSION_CONFIG.userListKey) || []
    const user = users.find((u) => u.id === userId)

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const data = storage.get<{ code: string; expiresAt: number }>(`verify_code_${userId}`)
    if (!data || Date.now() > data.expiresAt) {
      throw new Error('Código expirado. Solicite um novo.')
    }
    if (data.code !== code.trim()) {
      throw new Error('Código incorreto')
    }

    storage.remove(`verify_code_${userId}`)
    const updated = { ...user, emailVerified: true }
    storage.set(SESSION_CONFIG.userListKey, users.map((u) => (u.id === userId ? updated : u)))

    const { passwordHash: _, ...safeUser } = updated
    return safeUser
  },

  async sendVerificationEmailPublic(email: string): Promise<{ demoCode?: string; alreadyVerified?: boolean }> {
    if (config.realApi) {
      return realAuth.sendVerificationEmailPublic(email)
    }

    await delay(600)
    return { demoCode: undefined }
  },

  async confirmVerificationEmailPublic(email: string, code: string): Promise<boolean> {
    if (config.realApi) {
      const res = await realAuth.confirmVerificationEmailPublic(email, code)
      return res.success
    }

    await delay(600)
    return true
  },
}
