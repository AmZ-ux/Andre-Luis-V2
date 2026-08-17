import { config } from '../config'
import { transformKeys } from '../utils/transformKeys'
import { sessionManager } from '../auth/sessionManager'

interface ApiError {
  status: number
  message: string
  code?: string
  errors?: Record<string, string[]>
}

function toError(status: number, message: string, code?: string, errors?: Record<string, string[]>): Error & ApiError {
  const error = new Error(message) as Error & ApiError
  error.status = status
  error.code = code
  error.errors = errors
  return error
}

function getBaseUrl(): string {
  return config.apiUrl || '/api'
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
    throw toError(401, 'Sessão expirada')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    let code: string | undefined
    let errors: Record<string, string[]> | undefined
    try {
      const data = await res.json()
      if (typeof data?.error === 'string') message = data.error
      if (typeof data?.code === 'string') code = data.code
      if (data?.errors) errors = data.errors
    } catch {}
    throw toError(res.status, message, code, errors)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T

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

  async download(path: string): Promise<Blob> {
    const url = `${getBaseUrl()}${path}`
    const session = sessionManager.load()
    const headers: Record<string, string> = {}
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

    const res = await fetch(url, { headers })
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try { const d = await res.json(); message = d.error || message } catch {}
      throw toError(res.status, message)
    }
    return res.blob()
  },
}
