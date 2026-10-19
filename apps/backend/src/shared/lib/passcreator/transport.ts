/**
 * Passcreator HTTP transport layer.
 *
 * @module shared/lib/passcreator/transport
 */

import { BadGatewayError } from '../saomeError';
import { type PasscreatorEnv, requireEnv } from './env';
import { normalizePasscreatorErrorEntries } from './errors';

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
export async function passcreatorFetch(
  env: PasscreatorEnv,
  path: string,
  init: { method: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal },
): Promise<unknown> {
  const url = `${env.PASSCREATOR_API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    // V2 scheme: raw API key, no Bearer prefix. With `Bearer` prefix
    // Passcreator returns a silent 401 with empty body (saw 2026-10-11
    // against the real endpoint — `WWW-Authenticate: APIKey` header
    // hints at the raw-value convention; their docs also use bare
    // `Authorization: yourApiKeyHere` in every curl example).
    Authorization: env.PASSCREATOR_API_KEY,
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
    // Wrap as BadGatewayError with `kind: 'network'` so the frontend
    // banner can tell the user "check your internet connection" rather
    // than the generic "sync failed" copy. The request never reached
    // the upstream — no upstreamStatus to surface.
    const message = err instanceof Error ? err.message : String(err);
    throw new BadGatewayError({
      upstream: 'passcreator',
      kind: 'network',
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
      // Non-JSON response. This is typically a CDN/edge error (e.g.
      // Cloudflare 530 "Origin DNS error" / code 1016 — the CDN can't
      // reach the Passcreator origin). Mark as `kind: 'invalid_response'`
      // so the banner surfaces "service temporarily unavailable" instead
      // of the misleading "check your network connection".
      throw new BadGatewayError({
        upstream: 'passcreator',
        kind: 'invalid_response',
        upstreamStatus: response.status,
        upstreamBody: `non-JSON response: ${rawBody.slice(0, 200)}`,
      });
    }
  }

  if (!response.ok) {
    // Detect Passcreator V2's structured error envelope and pull
    // out the per-field `errors[]` (or single `errors` object — Passcreator
    // uses both shapes) for the frontend banner. We only attach
    // `upstreamErrors` when at least one valid entry exists; an empty
    // `errors` or a non-V2 envelope falls back to the raw `upstreamBody`
    // JSON in the details.
    //
    // `Kind: 'upstream_rejected'` is set whenever the body is a V2
    // envelope — regardless of whether `upstreamErrors` is populated.
    // The frontend banner uses this to pick the "Passcreator rejected
    // the data" copy.
    const normalized = normalizePasscreatorErrorEntries(parsed);
    if (normalized !== null) {
      throw new BadGatewayError({
        upstream: 'passcreator',
        kind: 'upstream_rejected',
        upstreamStatus: response.status,
        upstreamBody:
          typeof parsed === 'object' && parsed !== null
            ? JSON.stringify(parsed)
            : rawBody,
        ...(normalized.entries.length > 0
          ? { upstreamErrors: normalized.entries }
          : {}),
      });
    }
    // Body is not a V2 envelope (HTML login page, empty body, raw text,
    // or a non-V2 `{error: '...'}` shape). Surface as
    // `invalid_response` so the banner says "service temporarily
    // unavailable" instead of the misleading "Passcreator rejected the
    // data" copy.
    throw new BadGatewayError({
      upstream: 'passcreator',
      kind: 'invalid_response',
      upstreamStatus: response.status,
      upstreamBody:
        typeof parsed === 'object' && parsed !== null
          ? JSON.stringify(parsed)
          : rawBody,
    });
  }

  return parsed;
}

// Re-export requireEnv so callers (v2-template.ts, v3-pass.ts) can use it
// without importing from two different files.
export { requireEnv };
