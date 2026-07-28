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
const N = 16384;
const R = 8;
const P = 1;
// 128 MiB — comfortably above 128*r*N for both N=16384 (~16 MiB) and
// N=131072 (~128 MiB). Keeps the code future-proof if we bump params.
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const SCRYPT_OPTS = { N, r: R, p: P, maxmem: SCRYPT_MAXMEM } as const;

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
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  } catch {
    // scrypt can throw on platforms that reject the param set
    // (ERR_CRYPTO_INVALID_SCRYPT_PARAMS / memory limit). Treat as
    // "verification failed" rather than letting it bubble up as 500.
    return Promise.resolve(false);
  }
  try {
    return Promise.resolve(timingSafeEqual(actual, expected));
  } catch {
    return Promise.resolve(false);
  }
}