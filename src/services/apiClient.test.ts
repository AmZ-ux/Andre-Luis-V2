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
})

describe('apiClient', () => {
  it('should set auth header when token exists', async () => {
    const { sessionManager } = await import('../auth/sessionManager')
    const { api } = await import('./apiClient')

    ;(sessionManager as any).__setSession({ token: 'test-token', user: { name: 'Test' }, expiresAt: Date.now() + 3600000 })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { name: 'Test' } }),
    })

    await api.get('/auth/me')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-api:3001/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    )
  })

  it('should build query string from params', async () => {
    const { api } = await import('./apiClient')

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], total: 0 }),
    })

    await api.get('/passengers', { page: '1', pageSize: '15', search: 'joao' })

    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain('page=1')
    expect(callUrl).toContain('pageSize=15')
    expect(callUrl).toContain('search=joao')
  })

  it('should skip auth header when noAuth is true', async () => {
    const { api } = await import('./apiClient')

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy' }),
    })

    await api.get('/health', undefined, true)

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBeUndefined()
  })

  it('should throw ApiError on non-ok response', async () => {
    const { api } = await import('./apiClient')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Token inválido' }),
    })

    await expect(api.get('/auth/me')).rejects.toMatchObject({
      status: 401,
      message: 'Sessão expirada',
    })
  })

  it('should transform snake_case response to camelCase', async () => {
    const { api } = await import('./apiClient')

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        passenger_name: 'João',
        monthly_fee: 189.90,
      }),
    })

    const result: any = await api.get('/passengers/1')
    expect(result).toEqual({ passengerName: 'João', monthlyFee: 189.90 })
  })
})
