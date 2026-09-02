# Commit: 96634be — PIX Idempotency & Overpayment

**COMMIT:** `96634be`
**DATE:** 2025
**TITLE:** fix(payments): prevent duplicate pix charges and track overpayments

**OBJECTIVE:**
Prevent duplicate PIX charges and properly track overpayments.

**FILES_AFFECTED:**
- `server/src/services/paymentService.ts`
- `server/src/routes/payments.ts`
- `server/src/routes/payments.test.ts`

**WHAT_CHANGED:**
- Added `external_payment_id + entry_type` UNIQUE constraint on payments table
- Implemented deduplication logic for webhook processing
- Added OVERPAYMENT entry_type for payments exceeding fee amount
- Added pix_charges supersede logic (keep newest pending, mark rest as superseded)
- Added partial index: one pending pix_charge per monthly_fee

**WHY:**
Multiple webhook calls for the same payment could create duplicate records. Overpayments were not being tracked, making reconciliation impossible.

**TESTS:**
- Added tests for deduplication (same external_payment_id rejected)
- Added tests for overpayment tracking
- Added tests for pix_charges superseding

**RISKS:**
- Existing duplicate payments in production may violate new UNIQUE constraint
- Migration includes dedup logic to handle this (keeps oldest record)

**NOTES:**
- This is a critical financial integrity change
- The UNIQUE index is partial (WHERE external_payment_id IS NOT NULL) to allow legacy NULL records
