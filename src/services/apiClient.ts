import { config } from '../config'
import { transformKeys } from '../utils/transformKeys'
import { sessionManager } from '../auth/sessionManager'

interface ApiError {
  status: number
  message: string
  code?: string
  errors?: Record<string, string[]>
}

function getBaseUrl(): string {
  return config.apiUrl || 'http://localhost:3001/api'
}

function buildQueryString(params?: Record<string, any>): string {
  if (!params) return ''
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  options?: { params?: Record<string, any>; noAuth?: boolean }
): Promise<T> {
  const url = `${getBaseUrl()}${path}${buildQueryString(options?.params)}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!options?.noAuth) {
    const session = sessionManager.load()
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !options?.noAuth) {
    sessionManager.destroy()
    window.location.href = '/login'
    throw { status: 401, message: 'Sessão expirada' }
  }

  if (!res.ok) {
    const error: ApiError = { status: res.status, message: `HTTP ${res.status}` }
    try {
      const data = await res.json()
      error.message = data.error || error.message
      error.code = data.code
      error.errors = data.errors
    } catch {}
    throw error
  }

  const json = await res.json()
  return transformKeys<T>(json)
}

export const api = {
  get<T>(path: string, params?: Record<string, any>, noAuth?: boolean): Promise<T> {
    return request<T>('GET', path, undefined, { params, noAuth })
  },

  post<T>(path: string, body?: any, noAuth?: boolean): Promise<T> {
    return request<T>('POST', path, body, { noAuth })
  },

  put<T>(path: string, body?: any): Promise<T> {
    return request<T>('PUT', path, body)
  },

  patch<T>(path: string, body?: any): Promise<T> {
    return request<T>('PATCH', path, body)
  },

  delete<T>(path: string): Promise<T> {
    return request<T>('DELETE', path)
  },

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const url = `${getBaseUrl()}${path}`
    const session = sessionManager.load()
    const headers: Record<string, string> = {}
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

    const res = await fetch(url, { method: 'POST', headers, body: formData })
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try { const d = await res.json(); message = d.error || message } catch {}
      throw { status: res.status, message }
    }
    const json = await res.json()
    return transformKeys<T>(json)
  },
}
