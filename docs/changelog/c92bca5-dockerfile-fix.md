# Commit: c92bca5 — Dockerfile Runtime Fix

**COMMIT:** `c92bca5`
**DATE:** 2025
**TITLE:** fix: Dockerfile runtime sem --ignore-scripts

**OBJECTIVE:**
Fix production deployment crash caused by missing native bindings.

**FILES_AFFECTED:**
- `Dockerfile`

**WHAT_CHANGED:**
- Removed `--ignore-scripts` from `npm ci` in runtime stage
- Added explicit `npm rebuild better-sqlite3` for native compilation

**WHY:**
The runtime stage used `npm ci --omit=dev --ignore-scripts` which prevented the postinstall script from downloading prebuilt binaries for `better-sqlite3`. This caused:
- `ERR_DLOPEN_FAILED` on startup
- 502 Bad Gateway on Railway
- The app never booted successfully

**TESTS:**
- Docker build succeeds
- App boots without errors
- Healthcheck returns 200

**RISKS:**
- None (fix only)

**NOTES:**
- This was the root cause of all production 502 errors
- The prebuild needed is `node-v127-linuxmusl-x64`
- `--ignore-scripts` is appropriate for frontend-only builds but NOT for runtime with native deps
