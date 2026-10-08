import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: { realApi: true } as { realApi: boolean },
  realAuth: {
    login: vi.fn(),
    register: vi.fn(),
    changePassword: vi.fn(),
    me: vi.fn(),
  },
}))

vi.mock('../config', () => ({ config: mocks.config }))
vi.mock('../services/realApi', () => ({ realAuth: mocks.realAuth }))
vi.mock('../services/passengerService', () => ({
  passengerService: { create: vi.fn(), getById: vi.fn(), update: vi.fn() },
}))
vi.mock('../services/monthlyFeeService', () => ({
  monthlyFeeService: { create: vi.fn(), getMe: vi.fn() },
}))

const store = new Map<string, string>()

function stubWebStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
  vi.stubGlobal('sessionStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  })
}

async function loadAuthService(realApi: boolean) {
  mocks.config.realApi = realApi
  vi.resetModules()
  stubWebStorage()
  return import('./authService')
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 25))
}

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('seedUsers (default credentials in localStorage)', () => {
  it('realApi=true must NOT write app_users', async () => {
    await loadAuthService(true)
    await flush()

    expect(store.has('app_users')).toBe(false)
  })

  it('realApi=false keeps seeding the mock users', async () => {
    await loadAuthService(false)
    await flush()

    const users = JSON.parse(store.get('app_users') || 'null') as Array<{
      email: string
      passwordHash: string
      role: string
    }>
    expect(users).toHaveLength(2)
    expect(users.map((u) => u.email)).toEqual(['admin@transporte.com', 'passageiro@transporte.com'])
    expect(users.every((u) => typeof u.passwordHash === 'string' && u.passwordHash.length > 0)).toBe(true)
    expect(users.find((u) => u.role === 'admin')).toBeTruthy()
  })
})

describe('mock login (realApi=false)', () => {
  it('should login with the seeded default admin', async () => {
    const { authService } = await loadAuthService(false)
    await flush()

    const res = await authService.login({ login: 'admin@transporte.com', password: 'Admin@123', rememberMe: false })

    expect(res.user.email).toBe('admin@transporte.com')
    expect(res.user.role).toBe('admin')
    expect((res.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined()
    expect(res.token).toBeTruthy()
    expect(res.expiresAt).toBeGreaterThan(Date.now())
  })

  it('should reject an invalid mock password', async () => {
    const { authService } = await loadAuthService(false)
    await flush()

    await expect(
      authService.login({ login: 'admin@transporte.com', password: 'Wrong@123', rememberMe: false })
    ).rejects.toThrow('Credenciais inválidas')
  })
})

describe('real API authentication (realApi=true)', () => {
  it('should delegate login to the real client without touching app_users', async () => {
    mocks.realAuth.login.mockResolvedValue({
      user: { id: 'u1', name: 'Real', email: 'real@x.com', role: 'passenger' },
      token: 'real-token',
      expiresAt: Date.now() + 1000,
    })
    const { authService } = await loadAuthService(true)
    await flush()

    const res = await authService.login({ login: 'real@x.com', password: 'Real@123', rememberMe: false })

    expect(mocks.realAuth.login).toHaveBeenCalledWith({ login: 'real@x.com', password: 'Real@123', rememberMe: false })
    expect(res.token).toBe('real-token')
    expect(store.has('app_users')).toBe(false)
  })

  it('should keep delegating change-password to the real client (PUT contract untouched)', async () => {
    mocks.realAuth.changePassword.mockResolvedValue(undefined)
    const { authService } = await loadAuthService(true)
    await flush()

    await authService.changePassword('u1', 'Old@123', 'New@123')

    expect(mocks.realAuth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Old@123',
      newPassword: 'New@123',
    })
    expect(store.has('app_users')).toBe(false)
  })
})
