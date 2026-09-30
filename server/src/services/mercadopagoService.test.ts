import { describe, it, expect, vi, afterEach } from 'vitest'
import { MpError, mpStatus, mpAccessToken, mpBase, createPixCharge, getPayment, searchPaymentByExternalReference, createCardPaymentLink } from './mercadopagoService.js'
import { logger } from '../utils/logger.js'

process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-123'
process.env.MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/sandbox'

function mockFetch(status: number, body: any) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('mercadopagoService', () => {
  describe('mpStatus', () => {
    it('should map approved to paid', () => {
      expect(mpStatus('approved')).toBe('paid')
    })

    it('should map rejected and cancelled to cancelled', () => {
      expect(mpStatus('rejected')).toBe('cancelled')
      expect(mpStatus('cancelled')).toBe('cancelled')
    })

    it('should map everything else to pending', () => {
      expect(mpStatus('pending')).toBe('pending')
      expect(mpStatus('in_process')).toBe('pending')
      expect(mpStatus('authorized')).toBe('pending')
      expect(mpStatus('desconhecido')).toBe('pending')
    })
  })

  describe('mpAccessToken', () => {
    it('should throw a clear error when token is missing', () => {
      delete process.env.MERCADO_PAGO_ACCESS_TOKEN
      expect(() => mpAccessToken()).toThrow('MERCADO_PAGO_ACCESS_TOKEN')
      process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-123'
    })
  })

  describe('mpBase', () => {
    it('should use the configured API URL', () => {
      expect(mpBase()).toBe('https://api.mercadopago.com/sandbox')
    })

    it('should fall back to the default API URL', () => {
      delete process.env.MERCADO_PAGO_API_URL
      expect(mpBase()).toBe('https://api.mercadopago.com')
      process.env.MERCADO_PAGO_API_URL = 'https://api.mercadopago.com/sandbox'
    })
  })

  describe('createPixCharge', () => {
    it('should POST a pix payment with external reference and expiration', async () => {
      mockFetch(201, { id: 12345, status: 'pending', transaction_amount: 189.9, payment_method_id: 'pix' })
      const payment = await createPixCharge({
        amount: 189.9,
        description: 'Mensalidade 08/2026',
        monthlyFeeId: 'fee-abc',
        payerEmail: 'pass@test.com',
        payerCpf: '529.982.247-25',
        expiresInHours: 24,
      })
      expect(payment.id).toBe(12345)
      const fetchMock = fetch as any as ReturnType<typeof vi.fn>
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.mercadopago.com/sandbox/v1/payments')
      expect(options.method).toBe('POST')
      const body = JSON.parse(options.body)
      expect(body.payment_method_id).toBe('pix')
      expect(body.external_reference).toBe('fee-abc')
      expect(body.transaction_amount).toBe(189.9)
      expect(body.date_of_expiration).toContain('-03:00')
      expect(body.payer.email).toBe('pass@test.com')
      expect(body.payer.identification).toEqual({ type: 'CPF', number: '529.982.247-25' })
      expect(options.headers['Authorization']).toBe('Bearer TEST-123')
      expect(options.headers['X-Idempotency-Key']).toBeTruthy()
    })

    it('should throw MpError with MP message on error response', async () => {
      mockFetch(400, {
        message: 'O valor informado é inválido',
        cause: [{ code: 'INVALID_AMOUNT', description: 'Valor fora do intervalo permitido' }],
      })
      await expect(createPixCharge({
        amount: 0, description: 'x', monthlyFeeId: 'f', payerEmail: 'e@e.com',
      })).rejects.toThrow(MpError)
      await expect(createPixCharge({
        amount: 0, description: 'x', monthlyFeeId: 'f', payerEmail: 'e@e.com',
      })).rejects.toThrow(/Valor fora do intervalo permitido|inválido/)
    })

    it('should throw MpError with network message when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
      await expect(createPixCharge({
        amount: 50, description: 'x', monthlyFeeId: 'f', payerEmail: 'e@e.com',
      })).rejects.toThrow('Falha de conexão com o Mercado Pago')
    })
  })

  describe('getPayment', () => {
    it('should GET the payment by id', async () => {
      mockFetch(200, { id: 99, status: 'approved' })
      const payment = await getPayment(99)
      expect(payment.status).toBe('approved')
      const url = ((fetch as any).mock.calls[0])[0] as string
      expect(url).toContain('/v1/payments/99')
    })
  })

  describe('searchPaymentByExternalReference', () => {
    it('should return the first result', async () => {
      mockFetch(200, { results: [{ id: 1, status: 'approved' }] })
      const payment = await searchPaymentByExternalReference('fee-abc')
      expect(payment?.id).toBe(1)
      const url = ((fetch as any).mock.calls[0])[0] as string
      expect(url).toContain('external_reference=fee-abc')
    })

    it('should return null when there are no results', async () => {
      mockFetch(200, { results: [] })
      expect(await searchPaymentByExternalReference('fee-xyz')).toBeNull()
    })
  })

  describe('createCardPaymentLink', () => {
    it('should POST a checkout preference with back urls', async () => {
      mockFetch(201, { id: 'pref-1', init_point: 'https://checkout.mercadopago.com/xyz' })
      const pref = await createCardPaymentLink({
        amount: 200,
        description: 'Mensalidade 09/2026',
        monthlyFeeId: 'fee-2',
        payerEmail: 'p@test.com',
        payerName: 'Passageiro Teste',
      })
      expect(pref.init_point).toBe('https://checkout.mercadopago.com/xyz')
      const [url, options] = ((fetch as any).mock.calls[0])
      expect(url).toContain('/checkout/preferences')
      const body = JSON.parse(options.body)
      expect(body.items[0].unit_price).toBe(200)
      expect(body.external_reference).toBe('fee-2')
      expect(body.auto_return).toBe('approved')
      expect(body.back_urls.success).toContain('/minhas-mensalidades')
    })
  })
})

// PROD-04B.2B — observabilidade sanitizada de erros do Mercado Pago.
// Captura: status, error, message, cause[].code, cause[].description, x-request-id.
// Nunca registra: Authorization/token, CPF, e-mail, payer ou payload financeiro.
describe('observabilidade de erros do Mercado Pago (PROD-04B.2B)', () => {
  const CPF = '529.982.247-25'
  const EMAIL = 'pass@test.com'
  const TOKEN = 'TEST-123'

  function mockError(status: number, body: any, headers: Record<string, string> = {}) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status,
      headers: { get: (name: string) => headers[String(name).toLowerCase()] ?? null },
      text: () => Promise.resolve(JSON.stringify(body)),
    }))
  }

  async function failCharge() {
    return createPixCharge({
      amount: 350,
      description: 'Mensalidade 09/2026',
      monthlyFeeId: 'fee-obs',
      payerEmail: EMAIL,
      payerCpf: CPF,
    })
  }

  function logged(spy: { mock: { calls: any[][] } }): any {
    return spy.mock.calls[spy.mock.calls.length - 1]?.[0]
  }

  it('1. captura x-request-id da resposta', async () => {
    mockError(400, { message: 'Error in Financial Identity Use Case' }, { 'x-request-id': 'req-obs-1' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    expect(logged(spy).request_id).toBe('req-obs-1')
  })

  it('2. captura cause[].code', async () => {
    mockError(400, { message: 'm', cause: [{ code: '3001', description: 'Invalid payer identification' }] })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    expect(logged(spy).cause_codes).toEqual(['3001'])
  })

  it('3. captura cause[].description', async () => {
    mockError(400, { message: 'm', cause: [{ code: '3001', description: 'Invalid payer identification' }] })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    expect(logged(spy).cause_descriptions).toEqual(['Invalid payer identification'])
  })

  it('4. preserva error e message na resposta', async () => {
    mockError(400, { error: 'invalid_request', message: 'Error in Financial Identity Use Case' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    const log = logged(spy)
    expect(log.status).toBe(400)
    expect(log.error).toBe('invalid_request')
    expect(log.message).toBe('Error in Financial Identity Use Case')
  })

  it('5. CPF não aparece no log', async () => {
    mockError(400, { error: 'invalid_request', message: 'Error in Financial Identity Use Case' }, { 'x-request-id': 'req-obs-5' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    const raw = JSON.stringify(logged(spy))
    expect(raw).not.toContain(CPF)
    expect(raw).not.toContain(CPF.replace(/\D/g, ''))
  })

  it('6. e-mail do pagador não aparece no log', async () => {
    mockError(400, { error: 'invalid_request', message: 'Error in Financial Identity Use Case' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    expect(JSON.stringify(logged(spy))).not.toContain(EMAIL)
  })

  it('7. Authorization/token não aparece no log', async () => {
    mockError(400, { error: 'invalid_request', message: 'Error in Financial Identity Use Case' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    const raw = JSON.stringify(logged(spy))
    expect(raw).not.toContain('Bearer')
    expect(raw).not.toContain(TOKEN)
  })

  it('8. payload financeiro sensível fora do log (somente metadados permitidos)', async () => {
    mockError(400, { error: 'invalid_request', message: 'Error in Financial Identity Use Case' })
    const spy = vi.spyOn(logger, 'error')
    await expect(failCharge()).rejects.toThrow(MpError)
    const log = logged(spy)
    const raw = JSON.stringify(log)
    expect(raw).not.toContain('transaction_amount')
    expect(raw).not.toContain('payer')
    expect(raw).not.toContain('Mensalidade 09/2026')
    const allowed = ['status', 'path', 'message', 'error', 'cause_codes', 'cause_descriptions', 'request_id']
    expect(Object.keys(log).every((k) => allowed.includes(k))).toBe(true)
  })

  it('9. comportamento de erro para o frontend continua igual (status e message)', async () => {
    mockError(400, { message: 'Error in Financial Identity Use Case' })
    let err: any = null
    try { await failCharge() } catch (e) { err = e }
    expect(err).toBeInstanceOf(MpError)
    expect(err.status).toBe(400)
    expect(err.message).toBe('Error in Financial Identity Use Case')

    mockError(400, { message: 'msg crua', cause: [{ description: 'Valor fora do intervalo permitido' }] })
    let err2: any = null
    try { await failCharge() } catch (e) { err2 = e }
    expect(err2).toBeInstanceOf(MpError)
    expect(err2.status).toBe(400)
    expect(err2.message).toBe('Valor fora do intervalo permitido')
  })
})
