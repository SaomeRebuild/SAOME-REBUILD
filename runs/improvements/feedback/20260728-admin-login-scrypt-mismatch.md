# Bug-4b → Bug-4c → Bug-4d → Bug-5 → Bug-6 — full admin-login recovery chain — 2026-07-28

> This file logs six consecutive bugs in the auth → dashboard pipeline.
> Each was fixed in its own commit. Read top-to-bottom; each round
> addresses a single root cause, not a symptom of the previous.

## Index

| Round | Symptom (user-visible) | Root cause | Commit |
|-------|------------------------|------------|--------|
| Bug-4b | POST 500 + "Scrypt failed" | scrypt params mismatch between code & seed hash | `46dbd7a` |
| Bug-4c | POST 401, but request never reaches backend | `dist/` baked in `http://localhost:8787` (Mixed Content blocked in browser) | `d50da87` |
| Bug-4d | POST never sent, OPTIONS returns 204 with no CORS headers | `ALLOWED_ORIGINS` missing Workers preview subdomain | `bab5c97` |
| Bug-5  | POST 200 + Set-Cookie, but URL never changes | `LoginForm` never called `navigate()` + `/login` had no back-button guard | `e0f9f44` |
| Bug-6  | Login lands on dashboard, but card text is unreadable | `ComingSoonCard` used Tailwind neutral scale instead of design tokens | `0f349ba` |

**Key insight**: a server-side 200 with a `Set-Cookie` is **not** a working
login. The user has to see a meaningful next screen with usable contrast
before you can call the chain closed.

---

## Bug-4b: scrypt params mismatch + maxmem (commit `46dbd7a`)

### Symptom
POST `/api/auth/login` → 500 INTERNAL_ERROR. Worker Logs show
`details.original.message = "Scrypt failed"`.

### Root cause
`apps/backend/src/shared/lib/password.ts` used `N=131072 r=8 p=1` but the
admin seed hash in migration `003_seed_admin.sql` was generated with
`N=16384 r=8 p=1` (Node.js crypto.scrypt default). Plus OpenSSL's default
`maxmem=32 MiB` rejected `N=131072` (working set ~128 MiB).

### Fix
- Switch to `N=16384 r=8 p=1` to match the seed.
- Pass explicit `maxmem: 128 MiB` so future bumps don't fail.
- Wrap scrypt in try/catch; `verifyPassword` returns `false` instead of 500.
- New regression fixture `password.test.ts` pins the seed hash.

### Verification
- `apps/backend/src/shared/lib/password.test.ts`: 5/5 pass
- Backend full suite: 57/57 across 8 files

---

## Bug-4c: production bundle baked in localhost (commit `d50da87`)

### Symptom
After deploying `46dbd7a`, login still failed. Backend now returns 401
for invalid credentials, but the frontend sees a network failure (no
request reaches backend).

### Root cause
`apps/frontend/src/config/env.ts` defaulted `apiBaseUrl` to
`http://localhost:8787` regardless of build mode. Cloudflare Pages builds
the frontend on push with `npm run build` and no `VITE_API_BASE_URL` set,
so the localhost default got baked in.

When the deployed frontend (`https://saome-frontend.pages.dev/`) tries
to fetch `http://localhost:8787/...`, **the browser's Mixed Content
blocker silently drops the request**. The browser never sends it; the
user sees "login failed" with no network traffic reaching the backend.

### Fix
1. `apps/frontend/src/config/env.ts` — switch default based on
   `import.meta.env.PROD`:
   - dev → `http://localhost:8787`
   - prod → `https://saome-backend.josh1989213.workers.dev`
2. `apps/frontend/.env.production` (new) — explicit overrides committed
   so Vite picks them up regardless of `import.meta.env.PROD` derivation.
3. `apps/frontend/src/config/env.test.ts` (new) — regression test
   asserting apiBaseUrl is not localhost when running in production mode.

### Post-fix bundle grep
```bash
grep -c localhost:8787       dist/assets/*.js  # → 0
grep -c josh1989213.workers.dev dist/assets/*.js  # → 1
```

---

## Bug-4d: CORS allowlist missing Workers preview subdomain (commit `bab5c97`)

### Symptom
POST never sent. OPTIONS returns 204 No Content **with no CORS
headers**. DevTools shows the preflight succeed but the POST is never
made; the login attempts table in the DB has zero entries.

### Root cause
The user accessed the deployed frontend at
`https://saome-frontend.josh1989213.workers.dev/` (a Workers preview
URL), but `apps/backend/wrangler.jsonc` `ALLOWED_ORIGINS` only listed
`https://josh1989213.workers.dev` (bare apex). The corsMiddleware echoed
back no `Access-Control-Allow-Origin`, so the browser refused the POST
even though the preflight returned 204.

Worker Logs were the key diagnostic: Cloudflare Observability showed
the OPTIONS reaching the backend but the POST never appearing
(`$metadata.service eq saome-backend` filter).

### Fix
- `apps/backend/src/shared/middleware/cors.ts`: introduce
  `ALLOWED_ORIGIN_PATTERNS` (comma-separated host globs like
  `*.workers.dev`) alongside the existing exact-match list.
  `matchHostPattern()` handles `*.foo.com` style patterns.
  `resolveAllowedOrigin()` echoes the exact origin back when matched,
  so `Access-Control-Allow-Credentials: true` keeps working.
- `apps/backend/src/shared/types/bindings.ts`: declare
  `ALLOWED_ORIGIN_PATTERNS?: string` on Env.
- `apps/backend/wrangler.jsonc`: add
  `ALLOWED_ORIGIN_PATTERNS="*.josh1989213.workers.dev,*.saome-frontend.pages.dev,*.saome-admin.pages.dev,*.app.saome.org,*.admin.saome.org,*.saome.org"`
- `apps/backend/src/shared/middleware/cors.test.ts` (new): 13 unit
  tests covering exact match, host pattern match, multi-level
  subdomain, apex rejection, case-insensitivity, malformed origins.

### Vitest config update (same commit)
`apps/backend/vitest.config.ts`: wrangler 4.x requires
`WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` to be set
before initializing the worker runtime. The variable points at a dummy
local Postgres; tests `vi.mock('@/shared/db/client')` so no real
connection happens, but wrangler ≥ 4.30 refuses to start otherwise. We
default it in vitest.config.ts so `npm test` works without an env file.

### Verification
- Backend tests: 70/70 across 9 files (was 57/57; +13 cors tests)
- Backend typecheck: exit 0
- Backend build dry-run: `ALLOWED_ORIGIN_PATTERNS` visible in binding table
- Frontend tests: 161/161 (unchanged)

---

## Bug-5: LoginForm never navigates + /login has no back-button guard (commit `e0f9f44`)

### Symptom
POST 200 OK with Set-Cookie + access token. Refresh cookie set correctly
(`HttpOnly; Secure; SameSite=Lax; Path=/api/auth`). But the URL never
changes — the user is left staring at `/login` with a successful session
they couldn't see.

### Root cause (two compounding issues)
1. `LoginForm.onSubmit` called `login()` which set state in AuthProvider
   but never issued a `navigate()`. `RegisterForm` worked because its
   `onStep2Submit` called `useNavigate()` manually — behaviour was
   asymmetric between the two forms.
2. Even after the missing navigate was fixed, `LoginPage` and
   `RegisterPage` had no guard for "user is already authed". Hitting the
   back button after a successful login would re-render the
   `LoginForm` even though the session was live.

The auth domain already had the right primitive — `AuthGuard` — but
only in one direction (unauthed-on-private-route). The reverse direction
was missing.

### Fix
- `apps/frontend/src/components/business/auth/LoginForm/LoginForm.tsx`:
  call `useAuthRedirect()` at the top of the component. The hook
  watches AuthProvider's `isAuthenticated` flag and pushes the user to
  `ROLE_HOME_PATH[role]` as soon as the state transitions from
  unauthed → authed.
- `apps/frontend/src/pages/auth/LoginPage.tsx`: add a "back-button
  guard": if AuthProvider already has a session when LoginPage mounts,
  Navigate to the role's home. Same logic for `RegisterPage`.
- `apps/frontend/src/components/business/auth/LoginForm/LoginForm.test.tsx`
  (new): 2 regression tests asserting successful admin and tenant
  logins both land on the right route.
- `apps/frontend/src/pages/auth/LoginPage.test.tsx` (new): 2 tests
  covering the back-button case.

### Verification
- Frontend tests: 165/165 across 26 files (was 161/161; +4 new)
- Typecheck / lint / build: exit 0

---

## Bug-6: ComingSoonCard uses Tailwind neutral scale instead of design tokens (commit `0f349ba`)

### Symptom
Login succeeded, navigated to `/admin/dashboard`, but the placeholder
card rendered as:
- white card surface floating on the dark `#0F0F23` page background
- low-contrast title
- "Sign out" button invisible against dark chrome

### Root cause
`ComingSoonCard` and the inline sign-out button in
`AdminDashboardPage` were shadcn-style templates that hardcoded
Tailwind's neutral scale (`bg-white`, `text-neutral-900`,
`border-neutral-200`, etc.). They predated the design-token migration
in `design-system/MASTER.md`.

`.cursor/rules/010-uiux-pro-max.mdc` and `.specify/memory/constitution.md`
already forbade hardcoded colours, but the placeholders slipped through.

### Fix
- `apps/frontend/src/components/ui/feedback/ComingSoonCard.tsx`: replace
  every neutral class with a CSS custom property from the design system:
  - card surface:     `var(--color-card)`           (#1B1B30)
  - card border:      `var(--color-border)`         (#2D2D4A)
  - card text:        `var(--color-card-foreground)`
  - title:            `var(--color-foreground)`     (#F8FAFC)
  - description:      `var(--color-muted-foreground)` (#94A3B8)
  - icon:             `var(--color-muted-foreground)` + `aria-hidden="true"`
- `apps/frontend/src/pages/admin/AdminDashboardPage.tsx`: switch the
  inline sign-out button to `var(--color-border)` /
  `var(--color-foreground)` / transparent background, with
  `hover:opacity-80` for affordance.
- `apps/frontend/src/components/ui/feedback/ComingSoonCard.test.tsx`
  (new): 3 conformance tests including a runtime **forbidden-class
  scan** that fails any future contributor who reaches for
  `bg-white`, `neutral-{50..900}`, or `bg-[#abc]` arbitrary hex.

### Verification
- Frontend tests: 168/168 across 27 files (was 165/165; +3 new)
- Typecheck / lint / build: exit 0

---

## Process Lessons (cross-cutting, applies to every future session)

### Lesson 1 — Server-side 200 ≠ working user flow
A 200 response with the correct `Set-Cookie` is **not** a working login.
The user has to see a meaningful next screen with usable contrast
before you can call the chain closed. After every fix, manually walk
through the next screen in the deployed environment, not just the
Network panel.

### Lesson 2 — Mixed Content failures are invisible in curl
Curl happily sends `http://localhost:8787` from an HTTPS origin; the
browser silently drops the same request. Any time the frontend bundle
references an API URL, **grep the bundled JS** after `npm run build` to
verify it's the production URL, not a localhost default.

### Lesson 3 — CORS preflight failures leave no server-side trace
If Network shows OPTIONS 204 with no `Access-Control-Allow-Origin`
header, the browser drops the POST and the backend never sees it. The
DB will have **zero** login attempts for that user even after multiple
tries. Use Cloudflare Observability (`$metadata.service eq
saome-backend`) to verify each request actually reached the worker.

### Lesson 4 — Static allowlists don't scale to per-PR preview URLs
Either use a pattern env var (this fix) or move to a dynamic allowlist
keyed on a JWT-verified `X-Deploy-Token` header. Future PRs that spin
up new Workers preview URLs must not require a backend redeploy.

### Lesson 5 — Auth flow redirects are easy to forget
The most common "everything works on server, user says it's broken"
symptom in an SPA is a missing client-side redirect after a successful
state mutation. Always trace: did `setState` run → did it propagate →
did anything listen for it and call `navigate()`?

### Lesson 6 — Auth primitives tend to be implemented asymmetrically
`AuthGuard` covered unauthed-on-private-route but not
authed-on-public-route. Whenever you add a forward-direction guard,
add the reverse-direction one too.

### Lesson 7 — Bundle-level tests prevent env-var regressions
After every frontend build, grep `dist/assets/*.js` for the expected
API URL constant. Add this to `npm run build` as a post-build check
(recommended, not yet implemented — see "Open follow-ups").

### Lesson 8 — `useAuthRedirect` was dead code waiting to be wired
It was exported from `hooks/index.ts` and only consumed by
`RegisterForm`. Always grep for "exported but unused" hooks whenever
the auth domain is touched.

### Lesson 9 — "It works but it looks wrong" is still a P0 bug
A working login flow that lands on an unreadable page is worse than no
login flow at all. Add a **forbidden-class scan** to the test suite
for every L1 component (not just `ComingSoonCard`). Recommended next
session.

### Lesson 10 — Test access strategy matters
`screen.getByLabelText` relies on the i18n bundle being loaded. In
tests where i18next is not initialized, fall back to direct attribute
selectors like `container.querySelector('input[type=password]')`.
Vitest does not preload i18n by default.

---

## Open follow-ups (not done in this session)

1. **Bundle-level guard**: add a post-build script that greps
   `dist/assets/*.js` for the production API URL and fails the build
   if absent. Recommended in Lesson 7.
2. **Forbidden-class scan as a global lint rule**: extend the
   `ComingSoonCard.test.tsx` pattern to all of `apps/frontend/src/components/ui/`
   so neutral palette regressions get caught uniformly.
3. **`AuthGuard` reverse-direction**: extract the LoginPage/RegisterPage
   `isAuthenticated → Navigate` block into a reusable
   `<AuthenticatedRedirect>` component, sibling to `AuthGuard`. The
   pattern will be reused on every public route added later
   (forgot-password, terms, pricing for unauthed users).
4. **Vitest config env injection**: pin
   `WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in CI too —
   currently defaults in `vitest.config.ts` so it works locally but
   may surprise a fresh CI runner.
5. **Run script `bun run test:ci` / smoke test on every push to
   `main`**: this session shipped 5 commits without an automated
   integration smoke test. Manual verification caught the issues but
   only because the user was online and willing to test in incognito.

---

Refs: commits `46dbd7a`, `d50da87`, `bab5c97`, `e0f9f44`, `0f349ba`;
      PR-3 commit `85f03a6`;
      Cloudflare Pages Mixed Content rules
      https://developers.cloudflare.com/ssl/edge-certificates/mixed-content/