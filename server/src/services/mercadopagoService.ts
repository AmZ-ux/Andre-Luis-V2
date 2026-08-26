import { v4 as uuid } from 'uuid'
import { logger } from '../utils/logger.js'

const DEFAULT_BASE = 'https://api.mercadopago.com'

export function mpAccessToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor. Obtenha o Access Token (produção) em developers.mercadopago.com.br e configure em server/.env ou nas variáveis do Railway.')
  }
  return token
}

export function mpBase(): string {
  return process.env.MERCADO_PAGO_API_URL || DEFAULT_BASE
}

export class MpError extends Error {
  constructor(message: string, public status: number = 502) {
    super(message)
    this.name = 'MpError'
  }
}

interface MpErrorBody {
  message?: string
  error?: string
  cause?: Array<{ description?: string; code?: string }>
}

async function mpRequest<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${mpAccessToken()}`,
    'Content-Type': 'application/json',
  }
  const options: RequestInit = { method, headers }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
    headers['X-Idempotency-Key'] = idempotencyKey || uuid()
  }

  let res: Response
  try {
    res = await fetch(`${mpBase()}${path}`, options)
  } catch (err: any) {
    logger.error({ err: err.message, path }, 'Falha de rede ao chamar a API do Mercado Pago')
    throw new MpError('Falha de conexão com o Mercado Pago. Tente novamente em instantes.')
  }

  let data: any = null
  const raw = await res.text()
  if (raw) {
    try { data = JSON.parse(raw) } catch { data = null }
  }

  if (!res.ok) {
    let message = `Erro do Mercado Pago (HTTP ${res.status})`
    const errBody = data as MpErrorBody | null
    if (errBody?.message) message = errBody.message
    if (Array.isArray(errBody?.cause) && errBody.cause.length > 0) {
      message = errBody.cause.map((c) => c.description || c.code || 'erro desconhecido').join('. ')
    }
    logger.error({ status: res.status, path, message }, 'Erro na API do Mercado Pago')
    throw new MpError(message, res.status)
  }

  return data as T
}

export interface MpPayment {
  id: number
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'authorized'
  status_detail: string
  transaction_amount: number
  payment_method_id: string
  external_reference?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  }
}

export function mpStatus(status: string): 'paid' | 'pending' | 'cancelled' {
  if (status === 'approved') return 'paid'
  if (status === 'rejected' || status === 'cancelled') return 'cancelled'
  return 'pending'
}

function futureIsoBR(hours: number): string {
  const now = new Date(Date.now() + hours * 3600 * 1000)
  const iso = now.toISOString().replace('Z', '')
  return `${iso}-03:00`
}

export async function createPixCharge(data: {
  amount: number
  description: string
  monthlyFeeId: string
  payerEmail: string
  payerCpf?: string
  expiresInHours?: number
  idempotencyKey?: string
}): Promise<MpPayment> {
  const payment = await mpRequest<MpPayment>('POST', '/v1/payments', {
    transaction_amount: Number(data.amount.toFixed(2)),
    description: data.description,
    payment_method_id: 'pix',
    external_reference: data.monthlyFeeId,
    date_of_expiration: futureIsoBR(data.expiresInHours ?? 24),
    payer: {
      email: data.payerEmail || 'passageiro@transportesandreluis.com.br',
      ...(data.payerCpf ? { identification: { type: 'CPF', number: data.payerCpf } } : {}),
    },
  }, data.idempotencyKey)
  return payment
}

export async function getPayment(paymentId: number): Promise<MpPayment> {
  return mpRequest<MpPayment>('GET', `/v1/payments/${paymentId}`)
}

export async function searchPaymentByExternalReference(externalReference: string): Promise<MpPayment | null> {
  const res = await mpRequest<{ results: MpPayment[] }>(
    'GET',
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&limit=1&sort=date_created&criteria=desc`
  )
  return res.results && res.results.length > 0 ? res.results[0] : null
}

// Returns ALL payments for a given external_reference (no limit=1).
// Used when we need to find any approved payment, not just the most recent.
export async function searchAllPaymentsByExternalReference(externalReference: string): Promise<MpPayment[]> {
  const res = await mpRequest<{ results: MpPayment[] }>(
    'GET',
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`
  )
  return res.results || []
}

export interface MpPreference {
  id: string
  init_point: string
}

export async function createCardPaymentLink(data: {
  amount: number
  description: string
  monthlyFeeId: string
  payerEmail: string
  payerName: string
  notificationUrl?: string
}): Promise<MpPreference> {
  const preference = await mpRequest<MpPreference>('POST', '/checkout/preferences', {
    items: [
      {
        title: data.description,
        quantity: 1,
        unit_price: Number(data.amount.toFixed(2)),
        id: data.monthlyFeeId,
      },
    ],
    external_reference: data.monthlyFeeId,
    payer: {
      email: data.payerEmail || 'passageiro@transportesandreluis.com.br',
      name: data.payerName,
    },
    back_urls: {
      success: `${process.env.APP_URL || 'https://andre-luis-v2-production.up.railway.app'}/minhas-mensalidades`,
      failure: `${process.env.APP_URL || 'https://andre-luis-v2-production.up.railway.app'}/minhas-mensalidades`,
      pending: `${process.env.APP_URL || 'https://andre-luis-v2-production.up.railway.app'}/minhas-mensalidades`,
    },
    auto_return: 'approved',
    ...(data.notificationUrl ? { notification_url: data.notificationUrl } : {}),
  })
  return preference
}
