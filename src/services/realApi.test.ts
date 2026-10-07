import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../config', () => ({
  config: {
    apiUrl: 'http://test-api:3001/api',
  },
}))

vi.mock('../auth/sessionManager', () => {
  let mockSession: any = null
  return {
    sessionManager: {
      load: vi.fn(() => mockSession),
      destroy: vi.fn(() => { mockSession = null }),
      __setSession: (s: any) => { mockSession = s },
    },
  }
})

// Mock window.location for 401 redirect
Object.defineProperty(globalThis, 'window', {
  value: { location: { href: '' } },
  writable: true,
})

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as any

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockReset()
})

describe('realAuth.changePassword', () => {
  it('should call PUT /auth/change-password with the payload and auth header', async () => {
    const { sessionManager } = await import('../auth/sessionManager')
    const { realAuth } = await import('./realApi')

    ;(sessionManager as any).__setSession({ token: 'test-token', user: { name: 'Test' }, expiresAt: Date.now() + 3600000 })

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: true }),
    })

    await realAuth.changePassword({ currentPassword: 'Old@123', newPassword: 'New@123' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://test-api:3001/api/auth/change-password')
    expect(init.method).toBe('PUT')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    })
    expect(JSON.parse(init.body)).toEqual({ currentPassword: 'Old@123', newPassword: 'New@123' })
  })

  it('should resolve with the success payload', async () => {
    const { realAuth } = await import('./realApi')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: true }),
    })

    await expect(realAuth.changePassword({ currentPassword: 'Old@123', newPassword: 'New@123' })).resolves.toEqual({ success: true })
  })

  it('should propagate backend validation errors (wrong current password)', async () => {
    const { realAuth } = await import('./realApi')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Senha atual incorreta' }),
    })

    await expect(realAuth.changePassword({ currentPassword: 'Wrong@123', newPassword: 'New@123' })).rejects.toMatchObject({
      status: 400,
      message: 'Senha atual incorreta',
    })
  })

  it('should propagate unexpected server errors', async () => {
    const { realAuth } = await import('./realApi')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('invalid json') },
    })

    await expect(realAuth.changePassword({ currentPassword: 'Old@123', newPassword: 'New@123' })).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500',
    })
  })
})
