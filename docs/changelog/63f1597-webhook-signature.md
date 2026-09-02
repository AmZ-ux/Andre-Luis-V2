# Commit: 63f1597 — Webhook Signature Validation

**COMMIT:** `63f1597`
**DATE:** 2026-08
**TITLE:** fix(payments): validate webhook signature and bind payment id

**OBJECTIVE:**
Validate Mercado Pago webhook signatures and prevent payment ID manipulation.

**FILES_AFFECTED:**
- `server/src/routes/payments.ts`
- `server/src/services/mercadopagoService.ts`
- `server/src/services/webhookSignature.ts`
- `server/src/routes/paymentsWebhook.test.ts`
- `server/src/services/webhookSignature.test.ts`

**WHAT_CHANGED:**
- Added HMAC SHA-256 signature verification for webhooks
- Payment ID now extracted from signed payload, not user input
- Added `MERCADO_PAGO_WEBHOOK_SECRET` environment variable
- Fail closed: webhooks rejected if secret not configured
- Added reverse lookup: even with valid signature, payment is queried from MP

**WHY:**
Webhooks without signature verification could be spoofed, allowing attackers to mark arbitrary fees as paid. The payment ID must come from the verified payload, not user input.

**TESTS:**
- 15 new tests for webhook signature verification
- Tests for missing/invalid/mismatched signatures
- Tests for fail-closed behavior

**RISKS:**
- Production must have `MERCADO_PAGO_WEBHOOK_SECRET` configured
- Without it, ALL webhooks will be rejected (fail closed)

**NOTES:**
- This is a security-critical change
- The secret is generated in Mercado Pago dashboard
- Even with valid signature, the system queries MP for final verification
