/**
 * Passcreator env — type + validator.
 *
 * @module shared/lib/passcreator/env
 */

export interface PasscreatorEnv {
  PASSCREATOR_API_URL: string;
  PASSCREATOR_API_KEY: string;
  PASSCREATOR_PASS_TYPE_ID: string;
}

/**
 * Read Passcreator env from a Hono `c.env` or Cloudflare bindings.
 *
 * We accept a `Record<string, unknown>` so this module stays decoupled
 * from the Hono `HonoEnv` type (which is bound to specific binding
 * names). Service modules cast their own `c.env` to `PasscreatorEnv`.
 */
export function requireEnv(env: unknown): PasscreatorEnv {
  const e = (env ?? {}) as Partial<PasscreatorEnv>;
  if (!e.PASSCREATOR_API_URL) {
    throw new Error('[passcreator] PASSCREATOR_API_URL is not set');
  }
  if (!e.PASSCREATOR_API_KEY) {
    throw new Error('[passcreator] PASSCREATOR_API_KEY is not set');
  }
  if (!e.PASSCREATOR_PASS_TYPE_ID) {
    throw new Error('[passcreator] PASSCREATOR_PASS_TYPE_ID is not set');
  }
  return {
    PASSCREATOR_API_URL: e.PASSCREATOR_API_URL,
    PASSCREATOR_API_KEY: e.PASSCREATOR_API_KEY,
    PASSCREATOR_PASS_TYPE_ID: e.PASSCREATOR_PASS_TYPE_ID,
  };
}
