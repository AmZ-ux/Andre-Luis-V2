import { logger } from '../utils/logger.js'

const DEFAULT_BASE = 'https://www.asaas.com/api/v3'

export function asaasApiKey(): string {
  const key = process.env.ASAAS_API_KEY
  if (!key) {
    throw new Error('ASAAS_API_KEY não configurada no servidor. Configure a chave de API do Asaas (server/.env ou variáveis de ambiente do Railway).')
  }
  return key
}

export function asaasBase(): string {
  return process.env.ASAAS_API_URL || DEFAULT_BASE
}

export class AsaasError extends Error {
  constructor(message: string, public status: number = 502) {
    super(message)
    this.name = 'AsaasError'
  }
}

async function asaasRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${asaasBase()}${path}`
  const headers: Record<string, string> = {
    'access_token': asaasApiKey(),
    'Content-Type': 'application/json',
  }
  const options: RequestInit = { method, headers }
  if (body !== undefined) options.body = JSON.stringify(body)

  let res: Response
  try {
    res = await fetch(url, options)
  } catch (err: any) {
    logger.error({ err: err.message, url }, 'Falha de rede ao chamar a API do Asaas')
    throw new AsaasError('Falha de conexão com o Asaas. Tente novamente em instantes.')
  }

  let data: any = null
  const raw = await res.text()
  if (raw) {
    try { data = JSON.parse(raw) } catch { data = null }
  }

  if (!res.ok) {
    let message = `Erro do Asaas (HTTP ${res.status})`
    if (data && Array.isArray(data.errors) && data.errors.length > 0) {
      message = data.errors.map((e: { code?: string; description?: string }) => e.description || e.code || 'erro desconhecido').join('. ')
    } else if (data && typeof data === 'object' && (data as any).message) {
      message = (data as any).message
    }
    logger.error({ status: res.status, path, message }, 'Erro na API do Asaas')
    throw new AsaasError(message, res.status)
  }

  return data as T
}

export interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email?: string
  phone?: string
}

export interface AsaasCharge {
  id: string
  status: string
  value: number
  netValue: number
  billingType: string
  dueDate: string
  invoiceUrl?: string
  paymentUrl?: string
  externalReference?: string
  paymentDate?: string
  confirmedDate?: string
}

export interface AsaasPixQrCode {
  encodedImage: string
  payload: string
  expirationDate: string
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export async function findOrCreateCustomer(data: {
  name: string
  cpf: string
  email?: string
  phone?: string
}): Promise<AsaasCustomer> {
  const cpfCnpj = onlyDigits(data.cpf)
  if (cpfCnpj.length !== 11) {
    throw new AsaasError('CPF do passageiro inválido (é necessário ter 11 dígitos para gerar a cobrança no Asaas).', 400)
  }

  const search = await asaasRequest<{ data: AsaasCustomer[] }>('GET', `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`)
  if (search.data && search.data.length > 0) return search.data[0]

  const created = await asaasRequest<AsaasCustomer>('POST', '/customers', {
    name: data.name,
    cpfCnpj,
    ...(data.email ? { email: data.email } : {}),
    ...(data.phone ? { phone: onlyDigits(data.phone) } : {}),
  })
  return created
}

export async function createCharge(data: {
  customerId: string
  billingType: 'PIX' | 'CREDIT_CARD'
  value: number
  dueDate: string
  description: string
  monthlyFeeId: string
}): Promise<AsaasCharge> {
  const charge = await asaasRequest<AsaasCharge>('POST', '/payments', {
    customer: data.customerId,
    billingType: data.billingType,
    value: Number(data.value.toFixed(2)),
    dueDate: data.dueDate,
    description: data.description,
    externalReference: data.monthlyFeeId,
    pixTransactionEnabled: true,
  })
  return charge
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`)
}

export async function getPayment(paymentId: string): Promise<AsaasCharge> {
  return asaasRequest<AsaasCharge>('GET', `/payments/${paymentId}`)
}

export function toAsaasStatus(status: string): 'paid' | 'pending' | 'cancelled' | 'overdue' {
  switch (status) {
    case 'CONFIRMED':
    case 'RECEIVED':
      return 'paid'
    case 'CANCELLED':
    case 'REMOVED':
    case 'REFUNDED':
      return 'cancelled'
    case 'OVERDUE':
    case 'REFUND_REQUESTED':
      return 'overdue'
    default:
      return 'pending'
  }
}
