# Commit: 53eb12e — SQLite Migration

**COMMIT:** `53eb12e`
**DATE:** 2025
**TITLE:** feat: Fase 2 persistência — sql.js trocado por better-sqlite3

**OBJECTIVE:**
Migrate from sql.js (WebAssembly) to better-sqlite3 (native bindings) for production reliability.

**FILES_AFFECTED:**
- `server/src/database/connection.ts`
- `server/package.json`
- `railway.json`
- `Dockerfile`

**WHAT_CHANGED:**
- Replaced `sql.js` with `better-sqlite3` 12.11.1 (pinned)
- Enabled WAL mode for concurrent reads
- Added busy_timeout (5000ms)
- Added persistent volume at `/app/server/data`
- Fixed Dockerfile to not use `--ignore-scripts`

**WHY:**
sql.js runs in WebAssembly and has limitations:
- No WAL mode
- Data loss on unexpected shutdown
- Performance overhead
better-sqlite3 is the standard for Node.js SQLite:
- Native bindings (fast)
- WAL mode (concurrent reads)
- Persistent by default

**TESTS:**
- All existing tests continue to pass
- Tests use in-memory SQLite (`DATABASE_PATH=:memory:`)

**RISKS:**
- Requires native compilation during `npm install`
- Node 24+ has no prebuilds (must use Node 22.x)
- Docker must NOT use `--ignore-scripts`

**NOTES:**
- `better-sqlite3` is pinned at 12.11.1 because v13 removed prebuilds for some platforms
- This is a critical infrastructure change
