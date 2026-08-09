/**
 * Smoke test credentials template.
 * All smoke tests must import credentials from here, NOT hardcode them in specs.
 *
 * Usage:
 *   import { SMOKE_CREDENTIALS } from './template';
 *   const { email, password } = SMOKE_CREDENTIALS.admin;
 */

// NOTE: In production, these should come from environment variables.
// For now, these are test accounts with known credentials.
export const SMOKE_CREDENTIALS = {
  admin: {
    email: 'admin@saome.org',
    password: 'Qwww123123!',
  },
  tenant: {
    email: 'ppp@hotmail.com',
    password: 'www123123',
  },
} as const;
