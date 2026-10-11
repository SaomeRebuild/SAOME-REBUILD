/**
 * Passcreator API client — shared lib.
 *
 * @module shared/lib/passcreator
 * @description Thin wrapper around Passcreator's REST API for template
 * lifecycle operations (create / update / fetch). Used by the Step 8
 * "Save & Publish" hook to push the SAOME card template upstream so
 * Passcreator can issue the actual Apple Wallet / Google Wallet pass.
 *
 * Architecture (v4 plan):
 *   - This module owns the upstream contract. Service modules
 *     (`passTemplateMapping`, `passTemplateSync`) call into this and
 *     MUST NOT reach out to Passcreator directly.
 *   - All non-2xx responses throw `BadGatewayError` so the route layer
 *     maps them to a stable 502 + i18n key for the frontend banner.
 *   - Authentication uses the API key from `env.PASSCREATOR_API_KEY`,
 *     sent as `Authorization: Bearer <key>` (Passcreator's documented
 *     scheme per their API docs).
 *   - The Team Identifier (`U53JD8FLAG`) is NOT a backend concern.
 *     Apple Wallet signing is handled by Passcreator's own
 *     certificate infra; the SAOME backend only needs the API key.
 *
 * Rule references:
 *   - Rule 000 Part C.2 (third-party service module structure): one
 *     provider per file, SDK / fetch errors caught and re-thrown as
 *     SaomeError subclasses, no leakage of upstream types into the
 *     route layer.
 *   - Rule 019 § D.3 (third-party API is also a contract): the
 *     request/response types below mirror the Passcreator V2 API
 *     shape so the backend can validate the response before using
 *     any field. We don't use Passcreator's SDK (no published
 *     first-party SDK); the manual types are the contract.
 *   - Rule 017 (post-deploy CORS): the Passcreator URL is fetched
 *     server-to-server, no CORS concerns.
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md (plan)
 * @see .cursor/rules/000-modular-design.mdc Part C
 */

import { BadGatewayError } from './saomeError';

/**
 * Passcreator template body — the shape we send on `POST /v2/passes/templates`.
 *
 * Only the fields used by the SAOME Step 8 push are typed. Passcreator
 * accepts many more fields (barcode alt-text, app store links, etc.)
 * but the SAOME editor doesn't author them yet — we keep the contract
 * narrow to avoid sending zero-valued junk upstream.
 *
 * Field types map the Passcreator V2 API documentation as of 2026-10-11.
 * If Passcreator adds new required fields, the type must be updated and
 * the mapping module (`passTemplateMapping.ts`) must populate them.
 *
 * @see https://app.passcreator.com/en/api-documentation/v2
 */
export interface PasscreatorTemplateBody {
  /** Pass Type ID (Passcreator-side identifier). Comes from env. */
  passTypeId: string;
  /** Pass name (Apple Wallet: organization name shown on back). */
  name: string;
  /** Description shown in Apple Wallet / Google Wallet. */
  description: string;
  /** Organization name (Apple Wallet: passes.organizationName). */
  organizationName: string;
  /** Visual customization. */
  colors: {
    backgroundColor: string;
    foregroundColor: string;
  };
  /** Barcode configuration. */
  barcode: {
    format: 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417';
  };
  /** Image references. Empty object when no image is set. */
  images: {
    icon?: string;
    logo?: string;
    strip?: string;
  };
  /**
   * Localized fields. Each entry renders as a labeled row on the pass.
   *
   * `label` MUST be a localized string (from `getFieldLabelMap(language)`);
   * never hardcode the user-typed `settings.leftField` value as the label.
   * `key` matches `CardFieldKey` (e.g. 'phone', 'email') so the SAOME
   * member row can be looked up at issuance time.
   */
  fields: {
    headerFields: Array<{ key: string; label: string; value: string }>;
    primaryFields: Array<{ key: string; label: string; value: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
}

/**
 * Passcreator template response (the subset we care about).
 *
 * Passcreator returns a richer payload but the SAOME backend only
 * persists the `id` (and reuses the request body on subsequent updates).
 * Typed narrowly to make the consumer code type-safe.
 */
export interface PasscreatorTemplateResponse {
  id: string;
}

/**
 * Options for the fetch helpers.
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
function requireEnv(env: unknown): PasscreatorEnv {
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

/**
 * Internal: do a JSON request to Passcreator and parse the response.
 *
 * Throws `BadGatewayError` on:
 *   - non-2xx response
 *   - timeout
 *   - network failure (DNS, connection refused, etc.)
 *   - non-JSON response (truncated to 500 chars in the error)
 *
 * Note: Cloudflare Workers' `fetch` is built-in and supports `AbortSignal.timeout(ms)`.
 * We use a 15-second timeout — long enough for slow responses, short enough
 * to avoid the 30-second CPU limit when a series of upserts stack.
 */
async function passcreatorFetch(
  env: PasscreatorEnv,
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal },
): Promise<unknown> {
  const url = `${env.PASSCREATOR_API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.PASSCREATOR_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal ?? AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network-level failure (DNS, TLS, timeout, connection reset).
    // Wrap as BadGatewayError so the route layer can render a 502 banner.
    const message = err instanceof Error ? err.message : String(err);
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `network error: ${message}`,
    });
  }

  // Read the body once (Response.body can only be consumed once).
  const rawBody = await response.text();
  // Passcreator sometimes returns an empty 200/201 with no body — treat
  // as success and let the caller decode the response shape.
  let parsed: unknown = null;
  if (rawBody.length > 0) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // Non-JSON response. Surface as BadGateway so we don't silently
      // treat a 200-with-junk-body as success.
      throw new BadGatewayError({
        upstream: 'passcreator',
        upstreamStatus: response.status,
        upstreamBody: `non-JSON response: ${rawBody.slice(0, 200)}`,
      });
    }
  }

  if (!response.ok) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamStatus: response.status,
      upstreamBody:
        typeof parsed === 'object' && parsed !== null
          ? JSON.stringify(parsed)
          : rawBody,
    });
  }

  return parsed;
}

/**
 * Create a new Passcreator template.
 *
 * Returns the upstream `id` (UUID). The caller persists this to
 * `templates.passcreator_template_id` for subsequent `updatePassTemplate`
 * calls.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 */
export async function createPassTemplate(
  env: unknown,
  body: PasscreatorTemplateBody,
): Promise<PasscreatorTemplateResponse> {
  const e = requireEnv(env);
  // Passcreator V2 endpoint for create-template. Confirmed via the API
  // docs (2026-10-11). If this URL changes in a future Passcreator
  // release, only this function needs to update.
  const result = await passcreatorFetch(e, '/api/v2/passes/templates', {
    method: 'POST',
    body,
  });
  // Defensive parse: the response is documented as { id: string, ... },
  // but we extract the id without depending on the rest of the shape.
  const id = (result as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `create response missing id: ${JSON.stringify(result)}`,
    });
  }
  return { id };
}

/**
 * Update an existing Passcreator template by id.
 *
 * PUT semantics on Passcreator V2 (PATCH is also accepted; we use PUT
 * to match the "full template body" convention). Idempotent: a no-op
 * update (same body) returns 200 with the existing record.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 */
export async function updatePassTemplate(
  env: unknown,
  passcreatorTemplateId: string,
  body: PasscreatorTemplateBody,
): Promise<PasscreatorTemplateResponse> {
  const e = requireEnv(env);
  const result = await passcreatorFetch(
    e,
    `/api/v2/passes/templates/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'PUT', body },
  );
  const id = (result as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || id.length === 0) {
    // Passcreator V2 update returns the same envelope as create. If
    // the shape ever changes (e.g. PUT returning 204 No Content), we
    // treat the existing id as confirmation.
    return { id: passcreatorTemplateId };
  }
  return { id };
}

/**
 * Fetch a Passcreator template by id.
 *
 * Used by the test suite (and potentially by future "view upstream"
 * debugging tools). NOT used in the Step 8 hot path — the sync
 * service reads the cached body from the local DB row.
 *
 * @throws {BadGatewayError} on any non-2xx response, timeout, or network failure.
 * 404 from Passcreator is propagated as BadGatewayError with
 * upstreamStatus=404 (we don't surface "template not found upstream"
 * as a 404 to the SAOME client — the user-facing semantics are
 * "Passcreator rejected our request", which maps to 502).
 */
export async function fetchPassTemplate(
  env: unknown,
  passcreatorTemplateId: string,
): Promise<unknown> {
  const e = requireEnv(env);
  return passcreatorFetch(
    e,
    `/api/v2/passes/templates/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'GET' },
  );
}
