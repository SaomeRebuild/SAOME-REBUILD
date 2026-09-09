// One-shot: generate admin password hash with N=1024 (current production params).
// Mirrors apps/backend/src/shared/lib/password.ts hashPassword.
import { randomBytes, scryptSync } from 'node:crypto';

const N = 1024;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const password = process.argv[2];
if (!password) {
  console.error('usage: node scripts/hash-admin.cjs <password>');
  process.exit(1);
}

const salt = randomBytes(SALT_LEN);
const hash = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: SCRYPT_MAXMEM });
const out = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
process.stdout.write(out);
