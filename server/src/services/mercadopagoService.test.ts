import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MpError, mpStatus, mpAccessToken, mpBase, createPixCharge, getPayment, searchPaymentByExternalReference, createCardPaymentLink } from './mercadopagoService.js'

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
