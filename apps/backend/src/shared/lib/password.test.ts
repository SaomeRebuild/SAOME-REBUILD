/**
 * Unit tests for shared/lib/password (scrypt hash + verify).
 *
 * Critical invariant under test:
 *   hashPassword(s) and verifyPassword(s, hashPassword(s)) must agree.
 *
 * Regression fixture (admin seed hash from migration 003_seed_admin.sql):
 *   - email:        admin@saome.org
 *   - password:     Qwww123123!
 *   - stored hash:  scrypt$28d2de255da11d8f233940b867f8897b$<...>
 *   - scrypt params used to produce this hash:
 *       N = 16384 (NOT the OWASP 2024 recommendation of 131072),
 *       r = 8,
 *       p = 1.
 *   - Reason: the seed hash was generated before the code adopted the
 *     OWASP-recommended N; the bug-fix here is to make hashPassword +
 *     verifyPassword agree on N=16384 so the seed can be used.
 *     Future registrations are unaffected because both sides use the
 *     same params (per-tc below).
 *
 * Plus an explicit "scrypt memory-limit" regression: without `maxmem`
 * passed, OpenSSL rejects params N=131072 r=8 p=1 on small-memory
 * runtimes with ERR_CRYPTO_INVALID_SCRYPT_PARAMS. The implementation
 * must pass an explicit `maxmem` to avoid this and not throw 500.
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

// Admin seed hash from apps/backend/migrations/003_seed_admin.sql.
// Hash algorithm confirmed via repro-scrypt-params.cjs:
// scrypt with N=16384, r=8, p=1, salt=28d2de255da11d8f233940b867f8897b.
const ADMIN_SEED_HASH =
  'scrypt$28d2de255da11d8f233940b867f8897b$' +
  '49575e8e0c18307869f57464bd8f51b0cd39577b8819e386989a822b60331890477d5ecb0287175b9e729a01e8facc01be7e2f13cb774cd05f21b80dbed9fd1f';

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('verifyPassword accepts the admin seed hash for the operator-chosen password', async () => {
    // Regression for the production bug where login returned
    // 500 INTERNAL_ERROR with original.message = "Scrypt failed".
    // Root cause: verifyPassword used N=131072 r=8 p=1 but the seed
    // hash was generated with N=16384 r=8 p=1.
    const ok = await verifyPassword('Qwww123123!', ADMIN_SEED_HASH);
    expect(ok).toBe(true);
  });

  it('verifyPassword rejects a wrong password against the admin seed hash', async () => {
    const ok = await verifyPassword('wrong-password', ADMIN_SEED_HASH);
    expect(ok).toBe(false);
  });

  it('verifyPassword returns false (not throws) for malformed stored hash', async () => {
    const ok = await verifyPassword('whatever', 'not-a-scrypt-hash');
    expect(ok).toBe(false);
  });

  it('hashPassword + verifyPassword round-trip is consistent', async () => {
    const stored = await hashPassword('correct horse battery staple');
    const ok = await verifyPassword('correct horse battery staple', stored);
    expect(ok).toBe(true);
    const bad = await verifyPassword('wrong', stored);
    expect(bad).toBe(false);
  });

  it('does not throw "memory limit exceeded" under workerd (param-set compatibility)', async () => {
    // Regression for the second part of the production bug: scrypt was
    // invoked without an explicit `maxmem`, causing OpenSSL to throw
    // ERR_CRYPTO_INVALID_SCRYPT_PARAMS on the N=131072 default. The fix
    // is to pass maxmem >= 128*r*N (= 128*8*131072 = ~128 MiB).
    // We assert that both functions complete without throwing regardless
    // of the param set.
    const stored = await hashPassword('mem-test');
    expect(stored.startsWith('scrypt$')).toBe(true);
    const ok = await verifyPassword('mem-test', stored);
    expect(ok).toBe(true);
  });
});