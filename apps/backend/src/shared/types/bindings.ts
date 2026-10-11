/**
 * Cloudflare Workers bindings for saome-backend.
 *
 * @module shared/types/bindings
 * @description Centralized type definitions for env vars, secrets, and bindings.
 * Imported by `db/client.ts`, `lib/jwt.ts`, and modules that need typed access
 * to `c.env.HYPERDRIVE` etc.
 */

import type { Hyperdrive } from '@cloudflare/workers-types';
import type { R2Bucket } from '@cloudflare/workers-types';
import type { Sql } from '@/shared/db/client';

/**
 * Worker env shape, passed as `c.env` in Hono handlers.
 *
 * Hyperdrive binding comes from `wrangler.jsonc`.
 * Secrets (`JWT_SECRET`) are NOT declared here — they come from
 * `wrangler secret put` and are read as `string` at runtime.
 */
export interface Env {
  /** Hyperdrive binding (Postgres connection pool). */
  HYPERDRIVE: Hyperdrive;

  /** R2 bucket for card template assets (logo, background, icon). */
  ASSETS: R2Bucket;

  /** R2 API credentials for generating presigned URLs. */
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  /** Cloudflare account ID for R2 endpoint. */
  R2_ACCOUNT_ID: string;

  /** Allowed CORS origins (comma-separated). Default: localhost:5173. */
  ALLOWED_ORIGINS?: string;

  /**
   * Allowed CORS host patterns (comma-separated). Use for wildcard hosts
   * that can't be enumerated ahead of time, e.g. Workers preview URLs
   * (`*.josh1989213.workers.dev`) or first-party subdomains
   * (`*.saome.org`).
   *
   * Bug-4d context: the previous allowlist-only design forced us to add a
   * new ALLOWED_ORIGINS entry for every preview URL. Now we can glob.
   */
  ALLOWED_ORIGIN_PATTERNS?: string;

  /** Access token TTL in seconds. Default: 900 (15 min). */
  ACCESS_TOKEN_TTL?: string;

  /** Refresh token TTL in seconds. Default: 2592000 (30 days). */
  REFRESH_TOKEN_TTL?: string;

  /** API base URL (for redirect URLs in tokens). Default: api.saome.org. */
  API_BASE_URL?: string;

  /** Base URL for the public image proxy endpoint (GET /api/cards/:id/image/:type).
   *  Used by generate-upload-url.ts to construct the publicUrl returned to the frontend.
   *  Set via wrangler.jsonc vars.R2_PUBLIC_URL. */
  R2_PUBLIC_URL?: string;

  /**
   * B3 (2026-09-05): Backend's own public URL. Used by the warmup cron
   * (`/api/cron/warmup`) to do an internal fetch to `/health` so Hyperdrive
   * pool stays warm. Set via wrangler.jsonc vars.SAOME_BACKEND_URL.
   *
   * Phase 3.2 (2026-09-05): promoted from `?:` to required. The warmup
   * cron used to fall back to a hard-coded production URL when this was
   * unset, but that hides config drift — if someone deploys without
   * `vars.SAOME_BACKEND_URL`, the cron silently pings a foreign URL.
   * Required forces the deploy step to set it explicitly. Both dev
   * (wrangler dev reads vars from wrangler.jsonc) and prod
   * (`wrangler deploy` reads vars) provide it.
   */
  SAOME_BACKEND_URL: string;

  // =============================================================
  // Passcreator integration — Step 8 "Save & Publish" push (2026-10-11).
  // =============================================================
  // URL of the Passcreator V2 API. The base URL is `https://api.passcreator.com`
  // per their V2 documentation; the client strips any trailing slash and
  // appends `/api/v2/passes/templates` for create / update.
  // Set via wrangler.jsonc vars.PASSCREATOR_API_URL.
  PASSCREATOR_API_URL: string;

  // Apple Wallet pass type id, the SAOME-specific identifier Passcreator
  // issues Apple-signed passes under. Single-tenant-for-now design
  // (user decision 2026-10-11): every SAOME card uses the same
  // passTypeId. Per-tenant IDs are a future migration.
  // Set via wrangler.jsonc vars.PASSCREATOR_PASS_TYPE_ID.
  PASSCREATOR_PASS_TYPE_ID: string;

  // API key (sensitive — set via `wrangler secret put PASSCREATOR_API_KEY`,
  // NOT in wrangler.jsonc). The test key for local dev is in `.dev.vars`
  // (git ignored). Production secret is provisioned out-of-band by the
  // operator.
  // (Typed but not in the wrangler.jsonc `vars` block — the secret is
  //  delivered to the Worker at runtime via the Cloudflare secrets
  //  infrastructure.)
  /** @secret */
  PASSCREATOR_API_KEY?: string;
}

/**
 * Type-safe env access helper. Use this instead of `c.env` when you need
 * narrowed types (e.g., to make a missing binding a compile error).
 *
 * @example
 *   const env = getEnv<HonoEnv>(c);
 *   const db = getDb(env.HYPERDRIVE);
 *
 * NOTE: `Variables.user` mirrors the `AuthenticatedUser` interface in
 * `shared/middleware/auth.ts`. If you change one, change the other.
 */
export type HonoEnv = {
  Bindings: Env;
  Variables: {
    user: {
      id: string;
      email: string;
      role: 'tenant' | 'admin';
      /**
       * Optional tenant id — present for tenant users, undefined for admins.
       * Phase 3.2 (2026-09-09): added so `requireAuth` can populate from the
       * verified JWT without a DB lookup. See
       * `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`.
       */
      tenantId?: string;
    };
    /**
     * Per-request memoized postgres.js instance. Set by `getDbForRequest`
     * so subsequent calls within the same Hono request reuse the same pool
     * (and skip the eager warmup `SELECT 1`).
     */
    db?: Sql;
  };
};

/**
 * Sensitive runtime values that should NOT be committed to wrangler.jsonc.
 * Use `wrangler secret put` to provision in production; `.dev.vars` for local.
 */
export interface Secrets {
  /** HS256 signing key for access/refresh tokens. Min 32 chars. */
  JWT_SECRET: string;
}
