# Commit: 955eb83 — Remove Manual Fee Settlement

**COMMIT:** `955eb83`
**DATE:** 2025
**TITLE:** refactor(payments): remove manual fee settlement

**OBJECTIVE:**
Enforce that only the payment gateway can mark fees as paid.

**FILES_AFFECTED:**
- `server/src/routes/monthlyFees.ts`
- `server/src/routes/monthlyFees.test.ts`
- `server/src/services/paymentService.ts`

**WHAT_CHANGED:**
- Removed manual payment route (POST /monthly-fees/:id/pay)
- Removed admin ability to set status='paid' via PUT
- Added invariant: only finalizePayment() can change status to 'paid'
- Admin can only set: 'pending', 'cancelled', 'exempt'

**WHY:**
Manual fee settlement bypassed the payment gateway, creating inconsistencies between the system and Mercado Pago. Financial records must flow exclusively through the gateway.

**TESTS:**
- Added test: PUT status='paid' returns 400
- Added test: no payment created when rejecting status='paid'
- Updated existing tests to use gateway flow

**RISKS:**
- Admins can no longer manually mark fees as paid
- Historical manual payments are preserved but new ones cannot be created

**NOTES:**
- This is a business rule enforced at the API level
- The frontend already reflects this (no manual payment button for admins)
