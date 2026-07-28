# Bug-4b: Admin login still failed after PR-3 (root cause: scrypt params mismatch) — 2026-07-28
# Bug-4c: After Bug-4b fix, login STILL failed (root cause: production bundle baked in http://localhost:8787) — 2026-07-28 (continued)

## Symptom

User reported "還是登入不了阿" after PR-3 was deployed and merged. Frontend
showed both:

1. "登入失敗，請稍後再試" (login failed, please try again) — generic LoginForm error.
2. "嘗試次數過多，請稍後再試（剩餘 X 秒）" — frontend UX lockout timer ticking.

## Investigation

### Round 1 — CORS / Cookie / JWT_SECRET (PR-3 territory)

Direct curl against `https://saome-backend.josh1989213.workers.dev/api/auth/login`
with admin credentials returned 500 INTERNAL_ERROR with
`details.original.message = "Scrypt failed"`. CORS headers were correct.

**Root cause (Bug-4b):** password.ts used `N=131072 r=8 p=1` but the seed
hash in migration 003 was generated with `N=16384 r=8 p=1` (Node.js crypto.scrypt
default). Plus OpenSSL's default `maxmem=32 MiB` rejected `N=131072` (working
set ~128 MiB).

**Fix (commit 46dbd7a):**
- Switch to `N=16384 r=8 p=1` to match the seed.
- Pass explicit `maxmem: 128 MiB` so future bumps don't fail.
- Wrap scrypt in try/catch; verifyPassword returns false instead of 500.
- New regression fixture `password.test.ts` pins the seed hash.

### Round 2 — production bundle baked in wrong API URL (Bug-4c)

After deploying 46dbd7a, user reported login still failed. Re-probing backend
showed 401 UNAUTHORIZED for any credentials — Bug-4b fix was live. So the
problem wasn't backend anymore.

Inspecting the production frontend bundle:

```bash
# dist/assets/index-*.js contained:
localhost:8787        # ← WRONG
# but did NOT contain:
josh1989213.workers.dev
```

`apps/frontend/src/config/env.ts` defaulted `apiBaseUrl` to
`http://localhost:8787` regardless of build mode. Cloudflare Pages builds the
frontend on push with `npm run build` and no `VITE_API_BASE_URL` set, so the
localhost default got baked in.

When the deployed frontend (https://saome-frontend.pages.dev/) tries to
fetch `http://localhost:8787/...`, **the browser's Mixed Content blocker
silently drops the request**. The browser never sends it; the user sees
"login failed" with no network traffic reaching the backend.

**This explains the full symptom chain:**
- "登入失敗" — LoginForm's generic error after a network failure.
- "嘗試次數過多" — Frontend UX lockout ticking from previous attempts that
  also failed (but for the same Mixed Content reason, not backend 429).

**Fix (this commit):**

1. `apps/frontend/src/config/env.ts` — switch the default based on
   `import.meta.env.PROD`:
   - dev → `http://localhost:8787`
   - prod → `https://saome-backend.josh1989213.workers.dev`
2. `apps/frontend/.env.production` (new) — explicit overrides committed
   so Vite picks them up regardless of `import.meta.env.PROD` derivation.
3. `apps/frontend/src/config/env.test.ts` (new) — regression test asserting
   apiBaseUrl is not localhost when running in production mode.
4. After this commit:
   - `grep -c localhost:8787 dist/assets/*.js` → 0
   - `grep -c josh1989213.workers.dev dist/assets/*.js` → 1

## Why this wasn't caught in PR-3 / Bug-4b

- Local dev `npm run dev` reads `import.meta.env.VITE_API_BASE_URL` or
  falls back to localhost — works because Vite serves on localhost too.
- Local `npm run build` doesn't set `VITE_API_BASE_URL` either, but no one
  ran a `grep` on the bundled JS to check the URL constant.
- Cloudflare Pages builds without explicit env vars, so it falls back to
  whatever the source default is — and the default was wrong.
- No integration test pings the deployed bundle and decodes the URL.

## Verification

- `apps/backend/src/shared/lib/password.test.ts`: 5/5 new tests pass
- `apps/backend` full suite: 57/57 across 8 files
- `apps/frontend` full suite: 161/161 across 24 files (was 158/158; +3 env tests)
- typecheck (root + frontend + backend): exit 0
- build (frontend + backend): exit 0
- Backend probe (fake email): 401 UNAUTHORIZED ✅
- Frontend bundle grep: production URL present, localhost absent ✅

## Process Lessons (for self-improvement skill)

1. **Bundled URLs need bundle-level tests.** After every frontend build,
   grep the `dist/assets/*.js` for the expected API URL constant. Add this
   to `npm run build` as a post-build check.
2. **Mixed Content failures are invisible in curl but fatal in browsers.**
   Always verify the deployed frontend uses https URLs for any API call.
3. **Defaults must vary by build target.** Anything defaulting to localhost
   should branch on `import.meta.env.PROD` so production builds can't
   silently ship dev defaults.
4. **`grep` the bundle, don't trust `import.meta.env`.** Vite replaces
   env at build time; the only way to know what URL is in production is to
   read the bundled JS.
5. **`.env.production` should be checked into the repo.** CI / Cloudflare
   Pages may not set every env var, so committing explicit overrides
   ensures consistency across dev / staging / prod.

Refs: Bug-4 PR-3 commit `85f03a6`, Bug-4b commit `46dbd7a`,
      Cloudflare Pages Mixed Content rules
      https://developers.cloudflare.com/ssl/edge-certificates/mixed-content/