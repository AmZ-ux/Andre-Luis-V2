import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { validateMercadoPagoWebhookSignature, getWebhookSecret } from './webhookSignature.js'

const TEST_SECRET = 'test-webhook-secret-key-12345'

function buildXSignature(ts: string, secret: string, manifest: string): string {
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function buildManifest(dataId: string | undefined, xRequestId: string, ts: string): string {
  let manifest = ''
  if (dataId) {
    manifest += `id:${dataId.toLowerCase()};`
  }
  manifest += `request-id:${xRequestId};ts:${ts};`
  return manifest
}

describe('validateMercadoPagoWebhookSignature', () => {
  const xRequestId = '2066ca19-cf1-98a-be75-1923005edd06'
  const dataId = '12345'
  const ts = '1704908010'

  it('should accept valid signature', () => {
    const manifest = buildManifest(dataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    const result = validateMercadoPagoWebhookSignature({
      xSignature, xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('should reject invalid signature', () => {
    const manifest = buildManifest(dataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    // Tamper with v1
    const tampered = xSignature.replace(/v1=[a-f0-9]+/, 'v1=0000000000000000000000000000000000000000000000000000000000000000')
    const result = validateMercadoPagoWebhookSignature({
      xSignature: tampered, xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
  })

  it('should reject when x-signature is missing', () => {
    const result = validateMercadoPagoWebhookSignature({
      xSignature: undefined, xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('x-signature')
  })

  it('should reject when x-request-id is missing', () => {
    const manifest = buildManifest(dataId, '', ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    const result = validateMercadoPagoWebhookSignature({
      xSignature, xRequestId: undefined, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('x-request-id')
  })

  it('should reject when secret is not configured', () => {
    const result = validateMercadoPagoWebhookSignature({
      xSignature: 'ts=123,v1=abc', xRequestId: 'req-1', dataId: '1', secret: '',
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('secret')
  })

  it('should accept when data.id is absent (manifest without id segment)', () => {
    const manifest = buildManifest(undefined, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    const result = validateMercadoPagoWebhookSignature({
      xSignature, xRequestId, dataId: undefined, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(true)
  })

  it('should reject when timestamp is altered', () => {
    const manifest = buildManifest(dataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    // Replace ts in x-signature with a different value
    const alteredTs = '9999999999'
    const xSigAltered = xSignature.replace(`ts=${ts}`, `ts=${alteredTs}`)
    const result = validateMercadoPagoWebhookSignature({
      xSignature: xSigAltered, xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
  })

  it('should reject when hash is altered', () => {
    const manifest = buildManifest(dataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    // Change last char of v1
    const lastChar = xSignature.slice(-1)
    const newChar = lastChar === 'a' ? 'b' : 'a'
    const tampered = xSignature.slice(0, -1) + newChar
    const result = validateMercadoPagoWebhookSignature({
      xSignature: tampered, xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
  })

  it('should accept with uppercase data.id (lowercased internally)', () => {
    const upperDataId = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3'
    const manifest = buildManifest(upperDataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    const result = validateMercadoPagoWebhookSignature({
      xSignature, xRequestId, dataId: upperDataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(true)
  })

  it('should reject with wrong secret', () => {
    const manifest = buildManifest(dataId, xRequestId, ts)
    const xSignature = buildXSignature(ts, TEST_SECRET, manifest)
    const result = validateMercadoPagoWebhookSignature({
      xSignature, xRequestId, dataId, secret: 'wrong-secret',
    })
    expect(result.valid).toBe(false)
  })

  it('should reject malformed x-signature (no ts=)', () => {
    const result = validateMercadoPagoWebhookSignature({
      xSignature: 'v1=abc123', xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('malformed')
  })

  it('should reject malformed x-signature (no v1=)', () => {
    const result = validateMercadoPagoWebhookSignature({
      xSignature: 'ts=12345', xRequestId, dataId, secret: TEST_SECRET,
    })
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('malformed')
  })
})

describe('getWebhookSecret', () => {
  it('should return secret when configured', () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'my-secret'
    expect(getWebhookSecret()).toBe('my-secret')
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET
  })

  it('should return undefined when not configured', () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET
    expect(getWebhookSecret()).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = '  '
    expect(getWebhookSecret()).toBeUndefined()
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET
  })
})
