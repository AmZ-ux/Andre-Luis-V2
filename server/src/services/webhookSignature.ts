import crypto from 'crypto'

/**
 * Mercado Pago Webhook Signature Validator.
 *
 * Algorithm (official documentation):
 * 1. Parse x-signature header → extract ts and v1
 * 2. Get x-request-id from request header
 * 3. Get data.id from query string
 * 4. Build manifest: id:[data.id];request-id:[x-request-id];ts:[ts];
 *    (If data.id is absent, omit that segment from the manifest)
 * 5. HMAC-SHA-256(secret, manifest) → hex digest
 * 6. Compare with v1 using timing-safe comparison
 *
 * @see https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
 */

export interface WebhookSignatureInput {
  xSignature: string | undefined
  xRequestId: string | undefined
  dataId: string | undefined
  secret: string
}

export interface WebhookSignatureResult {
  valid: boolean
  reason?: string
}

/**
 * Parse the x-signature header into its components.
 * Format: "ts=1704908010,v1=618c85345248..."
 */
function parseXSignature(xSignature: string): { ts: string; v1: string } | null {
  const parts = xSignature.split(',')
  const tsPart = parts.find((p) => p.startsWith('ts='))
  const v1Part = parts.find((p) => p.startsWith('v1='))
  if (!tsPart || !v1Part) return null
  const ts = tsPart.slice(3)
  const v1 = v1Part.slice(3)
  if (!ts || !v1) return null
  return { ts, v1 }
}

/**
 * Build the manifest string exactly as Mercado Pago requires.
 *
 * Template: id:[data.id];request-id:[x-request-id];ts:[ts];
 *
 * If data.id is not present, the id segment is omitted.
 * data.id values with uppercase are lowercased per official docs.
 */
function buildManifest(dataId: string | undefined, xRequestId: string | undefined, ts: string): string {
  let manifest = ''
  if (dataId) {
    manifest += `id:${dataId.toLowerCase()};`
  }
  if (xRequestId) {
    manifest += `request-id:${xRequestId};`
  }
  manifest += `ts:${ts};`
  return manifest
}

/**
 * Validate Mercado Pago webhook signature using HMAC-SHA-256.
 *
 * Returns { valid: true } if signature is valid.
 * Returns { valid: false, reason } if invalid or missing.
 */
export function validateMercadoPagoWebhookSignature(input: WebhookSignatureInput): WebhookSignatureResult {
  const { xSignature, xRequestId, dataId, secret } = input

  if (!secret) {
    return { valid: false, reason: 'Webhook secret not configured' }
  }

  if (!xSignature) {
    return { valid: false, reason: 'x-signature header missing' }
  }

  if (!xRequestId) {
    return { valid: false, reason: 'x-request-id header missing' }
  }

  const parsed = parseXSignature(xSignature)
  if (!parsed) {
    return { valid: false, reason: 'x-signature header malformed' }
  }

  const { ts, v1 } = parsed

  const manifest = buildManifest(dataId, xRequestId, ts)

  const computed = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex')

  // Timing-safe comparison to prevent timing attacks
  try {
    const expectedBuf = Buffer.from(v1, 'hex')
    const computedBuf = Buffer.from(computed, 'hex')
    if (expectedBuf.length !== computedBuf.length) {
      return { valid: false, reason: 'Signature mismatch' }
    }
    const match = crypto.timingSafeEqual(expectedBuf, computedBuf)
    if (!match) {
      return { valid: false, reason: 'Signature mismatch' }
    }
  } catch {
    return { valid: false, reason: 'Signature comparison failed' }
  }

  return { valid: true }
}

/**
 * Get the webhook secret from environment.
 * Returns undefined if not configured (fail-closed behavior handled by caller).
 */
export function getWebhookSecret(): string | undefined {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret || secret.trim() === '') return undefined
  return secret
}
