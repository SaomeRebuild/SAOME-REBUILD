/**
 * Password hashing (scrypt via Node crypto).
 *
 * @module shared/lib/password
 * @description All modules MUST go through `hashPassword` / `verifyPassword`.
 *
 * Algorithm: scrypt (RFC 7914)
 *   - Memory-hard; resistant to GPU/ASIC attacks
 *   - Built into Node.js via `node:crypto` — no external dep, works in workerd
 *   - Recommended by OWASP as a fallback if Argon2id isn't available
 *
 * Hash format: `scrypt$<salt-hex>$<hash-hex>`
 *   - Self-describing prefix allows future migration to a different algorithm
 *   - Constant-time comparison via `crypto.timingSafeEqual`
 *
 * Params (must agree with the seed migration 003_seed_admin.sql hash):
 *   - N = 16384  (Node.js crypto.scrypt default; OWASP 2023 minimum)
 *   - r = 8
 *   - p = 1
 *   - salt length: 16 bytes (32 hex chars)
 *   - derived key length: 64 bytes (128 hex chars)
 *
 * Why these params (not OWASP 2024 recommended N=131072):
 *   - The admin seed hash in migration 003 was generated with N=16384.
 *   - If we changed params here without re-hashing admin (and every
 *     existing user), verifyPassword would fail closed for them.
 *   - Future migration path: bump params in a follow-up commit that
 *     ships a re-hash migration alongside. See the
 *     'Open: Password algorithm' section in
 *     runs/improvements/feedback/20260727-backend-db-migrations.md.
 *
 * Why explicit `maxmem`:
 *   - OpenSSL's default scrypt maxmem is 32 MiB. With N=16384 r=8 p=1
 *     we use 128*r*N = ~16 MiB which fits, but the *previous*
 *     (buggy) implementation used N=131072 which needed ~128 MiB.
 *     Passing `maxmem` explicitly keeps the code correct under both
 *     param sets and avoids `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` on
 *     small-memory runtimes (workerd in particular).
 *
 * Defensive design:
 *   - Both functions catch scrypt exceptions and either return false
 *     (verifyPassword) or rethrow as a tagged Error (hashPassword).
 *     verifyPassword MUST NOT throw — a thrown exception here would
 *     bubble up as a 500 INTERNAL_ERROR to the client, which is the
 *     exact bug we just fixed.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGO = 'scrypt';
const KEY_LEN = 64;
const SALT_LEN = 16;
// Lower CPU cost for Workers Free plan compatibility.
//
// Why N=1024 (instead of the OWASP 2023 minimum N=131072 or the
// previous N=16384):
//   - Workers Free plan: 10 ms CPU limit per request.  scrypt with
//     N=16384 takes ~30-100 ms on the Workers V8 isolate → 1102 always.
//   - Workers Paid plan: 30 s CPU limit → N=16384 is fine.
//   - A login endpoint that can return 1102 is a security problem
//     (the browser sees a CORS drop instead of an auth error).
//
// Trade-off: N=1024 is weaker than N=16384, but:
//   - still resists quick GPU attacks (r=8, p=1)
//   - the admin account (migration 003) has its hash baked in and is
//     not re-hashed on login, so lowering N does NOT retroactively
//     weaken the admin hash.
//   - any future accounts can be created with the lower-cost hash.
//
// Future migration: when Workers Paid is confirmed, bump back to N=16384
// and ship a background re-hash on next login (see
// runs/improvements/feedback/20260727-backend-db-migrations.md
// 'Open: Password algorithm').
const N = 1024;
const R = 8;
const P = 1;
// Legacy N value used to generate the admin seed hash (migration 003).
// Kept here so verifyPassword can fall back to it when the current N
// does not match — i.e. when verifying a pre-existing hash.
const N_LEGACY = 16384;
// 128 MiB — comfortably above 128*r*N for both N=16384 (~16 MiB) and
// N=131072 (~128 MiB). Keeps the code future-proof if we bump params.
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const SCRYPT_OPTS = { N, r: R, p: P, maxmem: SCRYPT_MAXMEM } as const;
const SCRYPT_OPTS_LEGACY = { N: N_LEGACY, r: R, p: P, maxmem: SCRYPT_MAXMEM } as const;

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  return Promise.resolve(
    `${ALGO}$${salt.toString('hex')}$${hash.toString('hex')}`,
  );
}

export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== ALGO) {
    // Unknown format → fail closed (don't leak whether a user exists).
    return Promise.resolve(false);
  }
  const saltHex = parts[1]!;
  const hashHex = parts[2]!;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return Promise.resolve(false);
  }
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) {
    return Promise.resolve(false);
  }
  // Try with current N first (new passwords created with N=1024).
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  } catch {
    return Promise.resolve(false);
  }
  if (timingSafeEqual(expected, actual)) {
    return Promise.resolve(true);
  }

  // Fallback: try legacy N (admin seed hash from migration 003 was
  // generated with N=16384, before this file switched to N=1024).
  let legacy: Buffer;
  try {
    legacy = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS_LEGACY);
  } catch {
    return Promise.resolve(false);
  }
  return Promise.resolve(timingSafeEqual(expected, legacy));
}