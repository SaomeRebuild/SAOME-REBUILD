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
 * Verification steps:
 *   1. Parse prefix; reject if not "scrypt"
 *   2. Decode salt (32 hex chars = 16 bytes)
 *   3. Decode expected hash (128 hex chars = 64 bytes)
 *   4. Recompute hash with same salt + same N/r/p params
 *   5. timingSafeEqual
 *
 * Future migration: if we want to switch to Argon2id (SAOME-13 verify-this
 * confirmed scrypt is the better MVP choice due to zero external deps), the
 * prefix becomes `argon2id$<params>$<salt>$<hash>` and `verifyPassword`
 * branches on prefix.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGO = 'scrypt';
const KEY_LEN = 64;
const SALT_LEN = 16;
// OWASP 2024 recommended scrypt params:
//   N = 2^17 = 131072 (CPU/memory cost)
//   r = 8 (block size)
//   p = 1 (parallelization)
const N = 131072;
const R = 8;
const P = 1;

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P });
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
  const actual = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P });
  return Promise.resolve(timingSafeEqual(actual, expected));
}