# Bug-5b — httpClient 401→429 Retry Storm — 2026-09-08

## Symptom (user-visible)

User in incognito mode with a stale refresh cookie:
1. All API calls return `401 Unauthorized` (access token expired)
2. `httpClient` triggers `tryRefresh()` — refresh endpoint returns `401` (cookie expired)
3. `tryRefresh()` returns `null` — but the code fell through to retry the original request
4. Original request retries with the same expired token → `401` again
5. Retry loop continues → 429 `Too Many Requests` (rate limiter counted each failed attempt)

User sees: rapid 401s followed by 429. In non-incognito, the same effect manifests as "login works but everything fails silently."

## Root cause

In `apps/frontend/src/services/httpClient.ts`, the `requestWithRetry` method handles 401 like this:

```
401 → tryRefresh() → if refresh succeeds: retry original request
                              → if refresh fails (null): ???fell through to original retry path???
```

The "fall through" path was the same retry logic for 5xx errors — it re-sent the
original request with `retryOn401: true` (set again), causing an infinite loop until
rate-limited.

The old code at the `if (!res.ok)` block didn't distinguish "refresh failed because
the token was invalid" from "refresh failed for a transient reason."

## Fix

**File**: `apps/frontend/src/services/httpClient.ts`

When `tryRefresh()` returns `null`, throw `SaomeApiError(401)` immediately — do NOT
retry the original request:

```typescript
// Before (bug):
if (!res.ok) {
  // ...this block fell through to retry without checking tryRefresh result
  throw new SaomeApiError(res.status, errBody);
}

// After (fix):
if (res.status === 401) {
  const newToken = await this.tryRefresh();
  if (newToken) {
    setAccessToken(newToken);
    return this.requestWithRetry<T>(method, path, { ...init, retryOn401: false }, attempt);
  }
  // Refresh failed (expired / revoked token).
  // Do NOT retry — that would loop 401 → tryRefresh → null → retry → 401 again.
  let errBody: unknown;
  try { errBody = await res.json(); } catch { errBody = { message: res.statusText }; }
  throw new SaomeApiError(res.status, errBody as SaomeApiError['error']);
}
```

**File**: `apps/frontend/src/services/authService.ts`

Removed redundant `withRefreshMutex` wrapper around `httpClient.post()`:
- `httpClient.request()` already has a shared mutex for in-flight `POST /api/auth/refresh`
  (via `tryRefresh` mutex)
- Two mutexes in the same call chain created deadlock risk

## Regression test

```typescript
// apps/frontend/src/services/httpClient.test.ts
it('regression 2026-09-08: tryRefresh null → immediate throw, no retry storm', async () => {
  // 401 on original request → 401 on refresh attempt
  // → exactly 1 call to /api/cards (original) + 1 call to refresh
  // Old bug: retry original after refresh fail → 3+ calls on /api/cards
  const originalCalls = fetchMock.mock.calls.filter(call => call[0].includes('/api/cards'));
  expect(originalCalls).toHaveLength(1);
});
```

## Verification

- `npm test --workspace=apps/frontend`: **11/11 passed** (httpClient.test.ts)
- `npx wrangler deploy`: backend Worker deployed to `https://saome-backend.josh1989213.workers.dev`
- CORS post-deploy check: 3/3 passed (OPTIONS / POST with origin / evil origin)

## Why the loop hit rate limiter but not the user directly

In non-incognito mode, the refresh token in the cookie jar was valid, so the loop
resolved after 1 retry. In incognito, the cookie was empty or expired, so `tryRefresh`
always returned `null`, and the loop continued until rate-limited.

This is why "it works in dev but not in incognito" — the same code path was triggered,
but the loop duration depended on the cookie state.

## Trigger condition

The retry storm fires whenever:
1. The `Authorization` header has an expired access token
2. AND the refresh mechanism (cookie or Authorization header) also fails

This is not a transient error — it's a persistent condition until the user logs in again.

## Related bugs

- `20260807-bug7-refresh-deploy-gap.md` — `tryRefresh` was called without mutex
  → concurrent 401s caused race conditions
- `20260905-auth-logout-batch.md` — Bug-4: tryRefresh mutex added, but the
  "fall through" retry path was left unhandled

## Self-improvement

Future sessions: when adding a `tryRefresh` call to handle 401, always write the
`null` case explicitly. "Fall through" is never safe in retry logic.
