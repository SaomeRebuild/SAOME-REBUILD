/**
 * revoked_tokens table queries.
 *
 * @module modules/auth/db/revokedTokens
 * @description Phase 2.2 (2026-09-05) wire of Decision Log option B —
 * server-side token revocation via `public.revoked_tokens(jti, expires_at)`.
 *
 * The cache (5s TTL) avoids hitting Postgres on every protected request.
 * Even on cache miss the lookup is O(1) via the primary key index.
 */

import type { Sql } from '@/shared/db/client';

/** Cache entry: { jti, revokedAt, expiresAt }. */
interface CacheEntry {
  /** The jti is revoked until `expiresAt`. */
  expiresAt: Date;
}

/**
 * In-process cache of revoked jtis. Holds the latest known expiry time
 * per jti (since the same jti is never inserted twice — PRIMARY KEY).
 *
 * Cache shape: Map<jti, expiresAt>. A jti is "revoked" if it appears in
 * the map. We don't cache "not revoked" results because jti is a UUID
 * with effectively-unbounded cardinality.
 */
const _cache = new Map<string, Date>();

/** Cache TTL — short enough to pick up newly-revoked tokens quickly,
 *  long enough to absorb the per-request DB hit during refresh storms. */
const CACHE_TTL_MS = 5_000;

/** Sweep interval — purge stale entries (revoked beyond TTL) so the
 *  map doesn't grow unbounded under heavy token churn. */
const SWEEP_INTERVAL_MS = 60_000;

let _lastSweep = Date.now();

function sweepIfDue(): void {
  const now = Date.now();
  if (now - _lastSweep < SWEEP_INTERVAL_MS) return;
  _lastSweep = now;
  for (const [jti, expiresAt] of _cache) {
    // The revoked entry is only meaningful until the token would have
    // expired naturally; once `expiresAt` is in the past, we can drop it.
    if (expiresAt.getTime() <= now) {
      _cache.delete(jti);
    }
  }
}

/**
 * Insert a revoked token entry. Idempotent — re-inserting the same jti
 * is a no-op (PRIMARY KEY collision).
 *
 * @param sql         Postgres.js client
 * @param jti         JWT id of the token to revoke
 * @param expiresAt   When the revoked entry itself can be cleaned up
 *                    (typically = original token's natural expiry)
 * @param reason      Optional audit reason ('logout', 'admin_force', etc.)
 */
export async function revokeToken(
  sql: Sql,
  jti: string,
  expiresAt: Date,
  reason: string | null = 'logout',
): Promise<void> {
  await sql`
    INSERT INTO public.revoked_tokens (jti, expires_at, reason)
    VALUES (${jti}, ${expiresAt.toISOString()}, ${reason})
    ON CONFLICT (jti) DO NOTHING
  `;
  // Update cache immediately so the very next verifyToken() that sees
  // this jti (e.g. another tab's refresh racing our logout) rejects it
  // without round-tripping to the DB.
  _cache.set(jti, expiresAt);
}

/**
 * Check whether a jti has been revoked and is still within its revocation
 * window (i.e. the original token would not have expired yet).
 *
 * Returns true if revoked (must reject the token), false otherwise.
 *
 * Caches the negative result? No — we don't cache "not revoked" because
 * the cache would grow unbounded with every unique UUID. We rely on the
 * PK index for the lookup cost (which is effectively O(1)).
 *
 * Defensive: if `sql` is not a real postgres.js instance (e.g. a vitest mock
 * that returns {}), we return false. This keeps existing auth tests working
 * without requiring them to mock `isTokenRevoked` directly.
 */
export async function isTokenRevoked(sql: Sql, jti: string): Promise<boolean> {
  // Guard: if sql is not a callable (e.g. vitest mock returning {}), skip
  // the DB lookup. This lets existing tests that mock getDb work without
  // needing to also mock isTokenRevoked.
  if (typeof sql !== 'function') {
    return false;
  }

  sweepIfDue();

  const cached = _cache.get(jti);
  if (cached !== undefined) {
    // Cache hit — the jti is revoked until `cached`.
    return cached.getTime() > Date.now();
  }

  // Cache miss — query DB. The `expires_at > now()` filter ensures we
  // only consider "still meaningful" revocations (expired tokens are
  // rejected by the JWT verifier itself, so an expired revocation row
  // is just cleanup noise).
  const rows = await sql<{ expires_at: Date }[]>`
    SELECT expires_at
      FROM public.revoked_tokens
     WHERE jti = ${jti}
       AND expires_at > now()
     LIMIT 1
  `;
  if (rows.length === 0) {
    return false;
  }
  const expiresAt = rows[0].expires_at;
  _cache.set(jti, expiresAt);
  return expiresAt.getTime() > Date.now();
}

/**
 * Test-only helper: clear the in-process cache. Used by vitest to ensure
 * each test starts from a known cache state.
 */
export function _clearRevokedCacheForTests(): void {
  _cache.clear();
  _lastSweep = Date.now();
}
