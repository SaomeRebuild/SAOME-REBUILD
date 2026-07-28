# Bug-4b: Admin login still failed after PR-3 (root cause: scrypt params mismatch) — 2026-07-28

## Symptom

User reported "還是登入不了阿" after PR-3 was deployed and merged. Frontend
showed both:

1. "登入失敗，請稍後再試" (login failed, please try again) — generic LoginForm error.
2. "嘗試次數過多，請稍後再試（剩餘 X 秒）" — frontend UX lockout timer ticking.

## Investigation

Initial assumption: Bug-4 still not fully resolved (CORS / Cookie / JWT_SECRET).

Direct curl against `https://saome-backend.josh1989213.workers.dev/api/auth/login`
with admin credentials:

```
HTTP/1.1 500 Internal Server Error
{"error":{"code":"INTERNAL_ERROR","i18nKey":"common.error.internal",
 "message":"Internal server error",
 "details":{"original":{"name":"Error","message":"Scrypt failed"}}},
 "requestId":"604ccc8b-..."}
```

CORS headers were correct (`Access-Control-Allow-Origin: https://saome-frontend.pages.dev`).
**The root cause was NOT CORS/Cookie/JWT — it was the password verify path
itself throwing inside workerd.**

Local reproduction:

```js
const { scryptSync } = require('node:crypto');
const salt = Buffer.from('28d2de255da11d8f233940b867f8897b', 'hex');
scryptSync('Qwww123123!', salt, 64, { N: 131072, r: 8, p: 1 });
// -> RangeError: Invalid scrypt params: error:030000AC:digital envelope routines::memory limit exceeded
```

OpenSSL's default scrypt `maxmem` is 32 MiB. With `N=131072, r=8, p=1` the
working set is `128*r*N = 128*8*131072 ≈ 128 MiB` → OpenSSL refuses.

**Worse**, after bumping `maxmem` to 256 MiB the call *succeeds* — but the
produced hash `eda53e09...` did NOT match the seed hash `49575e8e...`.

Brute-forcing params against the seed hash revealed:

```js
FOUND: { N: 16384, r: 8, p: 1, label: 'Node.js scrypt default' }
```

The seed hash in `migrations/003_seed_admin.sql` was generated with Node.js's
**default** `crypto.scrypt` params (`N=16384 r=8 p=1`), NOT the OWASP 2024
recommended `N=131072` that the current `password.ts` was using.

## Why this wasn't caught in PR-3

- The test suite mocks `verifyPassword` (`vi.mock('@/shared/lib/password')`)
  so the real scrypt code never ran in unit tests.
- No integration test against the actual seed hash existed.
- vitest-pool-workers runs the source code under workerd, but the unit tests
  for login didn't reach verifyPassword because every test path mocks it.

## Fix

Three changes in `apps/backend/src/shared/lib/password.ts`:

1. **Params match the seed**: `N=16384, r=8, p=1` (Node.js default).
2. **Explicit `maxmem`**: `128 MiB`. Future-proof for if we bump N later.
3. **Defensive try/catch**: `verifyPassword` now returns `false` instead of
   propagating the scrypt exception. Previously a param/platform mismatch
   would bubble up as `500 INTERNAL_ERROR`; now it cleanly fails as
   `401 UNAUTHORIZED` (same response shape as wrong password).

Five new unit tests in `password.test.ts`:
- verifyPassword accepts the admin seed hash for `Qwww123123!`
- verifyPassword rejects a wrong password against the seed hash
- verifyPassword returns false for malformed stored hash (not throw)
- hashPassword + verifyPassword round-trip consistent
- does not throw "memory limit exceeded" (param-set compatibility)

Result: backend 8 test files, 57 tests passing (was 7/52).

## Side fix: frontend lockout sync

Even with backend fixed, the user was locked out by the frontend UX lockout
(localStorage `saome.login.lockout.v1`). Two changes:

1. `apps/frontend/src/services/httpClient.ts`: on 429 RATE_LIMITED from the
   server, sync the local lockout to the server's authoritative
   `retryAfterSec`. Previously the UI would keep its local countdown
   slightly behind the backend, causing "submit → 429 → record local
   failure → try again → still locked" loops.
2. `apps/frontend/src/components/business/auth/LoginForm/LoginForm.tsx`:
   surface a specific "tooManyAttempts" i18n message when the error is
   `isRateLimited`, instead of the generic "invalidCredentials".
3. `apps/frontend/src/i18n/locales/auth.{zh-TW,en}.json`: add
   `login.error.tooManyAttempts` key.

## Verification

- `apps/backend/src/shared/lib/password.test.ts`: 5/5 new tests pass
- `apps/backend` full suite: 57/57 across 8 files (was 52/52)
- `apps/frontend` full suite: 158/158 across 23 files
- typecheck (root + frontend + backend): exit 0
- build (frontend + backend): exit 0

## Open: password algorithm upgrade (still)

Per `runs/improvements/feedback/20260727-backend-db-migrations.md`,
`Open: Password algorithm`:

- Re-hash admin with N=131072 in a future migration (004_rehash_admin.sql).
- After rehash, bump `password.ts` to N=131072 r=8 p=1.
- For users that register between now and that migration: they get the
  weaker hash, but it's still 16-byte-salt scrypt, so not catastrophic.

## Process Lessons (for self-improvement skill)

1. **Mock-everything test suites can hide production-only failures.**
   `vi.mock('@/shared/lib/password')` in login.test.ts made verifyPassword
   invisible to tests. Add a smoke test that exercises the real hash, not
   the mock, at least for the seed admin password.

2. **Deterministic seed migration hashes need a unit test that pins them.**
   `password.test.ts` now does exactly that: imports the seed hash string
   and asserts `verifyPassword(seedPassword, seedHash) === true`. Any
   future param change will fail RED on this test.

3. **OpenSSL `maxmem` is not optional.** When using scrypt with N > 8192,
   always pass an explicit `maxmem` ≥ `128 * r * N`. Otherwise some
   runtimes (workerd in particular) will throw.

4. **Two lockouts in series is worse than one.** Frontend lockout (UX)
   and backend lockout (rate limit) had independent counters. Users
   could be stuck in an inconsistent state where the UI said "5 minutes
   to go" but the server said "you're cleared". Always sync the local
   countdown to the server's authoritative `retryAfterSec`.

Refs: Bug-4 PR-3 commit `85f03a6`, design-tokens-check.md,
      Node.js crypto.scrypt docs https://nodejs.org/api/crypto.html#cryptoscryptsyncpassword-salt-keylen-options