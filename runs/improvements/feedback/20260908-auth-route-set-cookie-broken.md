# Bug-6 — Auth Route Set-Cookie Silently Dropped — 2026-09-08

## Symptom (user-visible)

After a successful login, the refresh token was never persisted in the browser cookie jar:
1. User logs in → 200 OK + access token in response body
2. Access token in memory (response body) works for the current session
3. Tab is closed or token expires → refresh attempt fails
4. User is silently logged out (no error message, just "unauthorized")

The `Set-Cookie` header was being sent by the server but was never received by the browser.

## Root cause

In `apps/backend/src/modules/auth/routes/login.ts`, `logout.ts`, and `refresh.ts`:

```typescript
// Before (bug):
const jsonResponse = c.json({ user, tenant, accessToken, ... });
jsonResponse.headers.append('Set-Cookie', cookieHeader);  // ← NO-OP!
return jsonResponse;
```

Hono's `c.json()` returns an **immutable `Response` object**. The `.headers` property
is a read-only `Headers` instance. Calling `.append()` on it is a silent no-op —
no error, no warning, no log entry.

The `Set-Cookie` header was never transmitted to the browser, so the refresh token
was never stored in the cookie jar.

## Why curl showed the header but the browser didn't

When testing from curl (no Origin header, no browser CORS rules):
- The backend returned the Set-Cookie header (we can see it in wrangler logs)
- curl displays the header even if the browser would have ignored it

When testing from a browser (HTTPS origin, CORS policy active):
- If the Set-Cookie header was actually present, the browser would store it
- But it was silently dropped (no-op in Hono), so the browser never saw it

This is a different failure mode from the CORS drop in Bug-4c (2026-07-28):
- Bug-4c: the header was present but CORS policy dropped it
- Bug-6: the header was never present because the code was a no-op

## Fix

Pass `Set-Cookie` as the third argument to `c.json()` — the correct Hono API:

```typescript
// After (fix):
return c.json(
  { user, tenant, accessToken, ... },
  200,
  { 'Set-Cookie': cookieHeader },
);
```

This works because `c.json(body, status, headers)` passes `headers` to the underlying
`Response` constructor, which accepts them during creation.

### Files changed

- `apps/backend/src/modules/auth/routes/login.ts`
- `apps/backend/src/modules/auth/routes/logout.ts`
- `apps/backend/src/modules/auth/routes/refresh.ts`

## Why this was introduced

The old code pattern:
```typescript
const response = c.json({ ... });
response.headers.set('X-Custom', 'value');
```

Works in Node.js/Express where `res.json()` returns a mutable object.
Hono returns an immutable `Response` — the `.headers` property is read-only.

The migration from Express-style patterns to Hono introduced this bug without any
type errors (TypeScript doesn't catch runtime mutability violations on `Response.headers`).

## Missing guard

There was no test asserting that the `Set-Cookie` header was present in the
response. The only test coverage was for the HTTP status code and response body.

**Consequence**: this bug existed undetected for the entire lifetime of the auth
module. It was discovered only when investigating the "refresh doesn't work" symptom
in a separate session.

## Regression test needed

See commit `0ae4cab` — this feedback document is written before the backend
Set-Cookie regression test is added (todo item #4 in the session plan).

The backend test should assert that `POST /api/auth/login` with valid credentials
returns a response with a `Set-Cookie` header containing `saome_refresh=...`.

## Related bugs

- `20260728-admin-login-scrypt-mismatch.md` — Bug-4: first 6 auth chain bugs
  (scrypt / localhost bundle / CORS / navigate / ComingSoonCard)
- `20260905-auth-logout-batch.md` — Auth logout Phase 2 Set-Cookie clear pattern
- `20260907-cors-runtime-503-fix.md` — Bug-7: CORS runtime-emitted 503

## Self-improvement

1. Any response header mutation after `c.json()` / `c.json()` is a red flag.
   The correct Hono API is `c.json(body, status, headers)`.

2. Any `Set-Cookie` behavior should have a dedicated test asserting the header
   is present in the response. A test that only checks `status === 200` is
   insufficient.

3. For future Hono routes: use `c.json()` with a third `headers` argument for
   any response header (not just Set-Cookie). Mutating the response after
   construction is a category error in Hono.
