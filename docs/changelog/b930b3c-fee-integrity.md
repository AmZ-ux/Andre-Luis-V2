# Commit: b930b3c — Fee Integrity & Backup Restore

**COMMIT:** `b930b3c`
**DATE:** 2026-09-02
**TITLE:** fix(data): harden fee integrity and backup restore

**OBJECTIVE:**
Harden financial data integrity and backup atomicity.

**FILES_AFFECTED:**
- `server/src/services/feeAutomation.ts`
- `server/src/database/schema.ts`
- `server/src/services/backupService.ts`
- `server/src/routes/auth.test.ts`
- `server/src/routes/authorization.test.ts`
- `server/src/routes/dashboard.test.ts`
- `server/src/routes/monthlyFees.test.ts`
- `server/src/services/backupService.test.ts`
- `server/src/services/feeAutomation.test.ts`

**WHAT_CHANGED:**

### SUBPAYMENT→OVERDUE Fix
- `markOverdueFees` query now filters by `entry_type IN ('NORMAL', 'OVERPAYMENT')`
- SUBPAYMENT (partial payment) no longer prevents overdue marking

### UNIQUE Constraint (Fail-Safe)
- Added `CREATE UNIQUE INDEX` on `monthly_fees(passenger_id, month, year)`
- Migration detects duplicates BEFORE creating index
- If duplicates exist: throws error, does NOT delete any data
- Logs detailed error with passenger ID, month, year, count

### Backup Atomicity
- `restoreBackup()` wrapped in `db.transaction()`
- All DELETEs and INSERTs are atomic
- Rollback on any failure

### Test Fixes
- authorization.test.ts: future date for retroactive check
- auth.test.ts: timeout increased for bcrypt-heavy lock test
- dashboard.test.ts: two passengers in same month (respects UNIQUE)

**WHY:**
- SUBPAYMENT was incorrectly preventing overdue marking (partial payments don't quit fees)
- Destructive dedup migration was deleting financial data without authorization
- Backup restore was not atomic (partial restore possible on failure)

**TESTS:**
- 5 new tests for SUBPAYMENT→OVERDUE behavior
- 1 new test for fail-safe dedup migration
- 3 new tests for backup atomicity
- Total: 479 tests (26 files)

**RISKS:**
- If production database has duplicate monthly_fees, migration will throw on startup
- Requires manual intervention to resolve duplicates before deploy

**NOTES:**
- This is the most critical integrity change in the project
- The fail-safe approach ensures no data is lost even with legacy duplicates
