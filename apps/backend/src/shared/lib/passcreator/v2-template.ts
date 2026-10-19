/**
 * Passcreator V2 template operations.
 *
 * @module shared/lib/passcreator/v2-template
 */

import { BadGatewayError } from '../saomeError';
import { type PasscreatorEnv, requireEnv } from './env';
import { passcreatorFetch } from './transport';
import { type PasscreatorTemplateBody } from './v2-template-types';

/**
 * Passcreator template response — V2 standardized envelope.
 *
 * As of Passcreator V2 (2026-10-11 docs + live capture), every
 * response (success and error) follows the same envelope:
 *
 *   Success (e.g. POST /api/v2/pass-template → 201):
 *     {
 *       success: true,
 *       description: "Template was created successfully!",
 *       errors: [],
 *       data: { identifier: "<UUID>" },     ← id lives here
 *       statusCode: 201,
 *     }
 *
 *   Error (e.g. POST with missing fields → 400):
 *     {
 *       success: false,
 *       description: "Invalid data.",
 *       errors: [{ property: "name", message: "..." }]   // or singular object
 *         | { property: "...", message: "..." },
 *       data: [],
 *       statusCode: 400,
 *     }
 *
 * The template id is consistently at `data.identifier` on success.
 * Earlier versions of this client read top-level `result.id`, which
 * fails against the real endpoint with `create response missing id`
 * (regression 2026-10-12 — two production pushes returned a 201
 * envelope but the parser couldn't locate the id). The parser now
 * reads `data.identifier` and falls back to top-level `id` for
 * robustness against older Passcreator clients / test doubles.
 *
 * See:
 *   - https://app.passcreator.com/en/api-documentation/v2 (template mgt)
 *   - fixtures/passcreator/success-create.json (live-captured 2026-10-12)
 *   - runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md
 *     (root cause + fix trace)
 */
export interface PasscreatorTemplateResponse {
  id: string;
}

/**
 * Extract the template id from a Passcreator V2 response payload.
 *
 * Lookup order:
 *   1. `data.identifier`  ← V2 standard envelope (success)
 *   2. top-level `id`     ← legacy / test-double shape
 *
 * Returns `null` when neither path yields a non-empty string. The
 * caller (`createPassTemplate`, `updatePassTemplate`) decides
 * whether to surface this as `BadGatewayError` (create: must throw;
 * update: falls back to the requested id as an "update accepted" signal).
 *
 * We do NOT look for `id` anywhere else — Passcreator V2 docs put
 * the template id exclusively at `data.identifier`, and listening
 * to the legacy top-level shape would mask envelope-shape drift.
 */
function extractTemplateId(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // V2 envelope: read data.identifier first.
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const identifier = (data as Record<string, unknown>).identifier;
    if (typeof identifier === 'string' && identifier.length > 0) {
      return identifier;
    }
  }
  // Legacy / test-double: top-level id.
  const topLevel = obj.id;
  if (typeof topLevel === 'string' && topLevel.length > 0) {
    return topLevel;
  }
  return null;
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
  // docs (2026-10-11). The base host is `https://app.passcreator.com`
  // (NOT `api.passcreator.com` — that subdomain does not resolve;
  // the V1/V2/V3 API docs all use `app.passcreator.com`). The path
  // is `/api/v2/pass-template` (singular, hyphenated — V1 used
  // `/api/pass` and V2 docs use the singular form consistently). If
  // this URL changes in a future Passcreator release, only this
  // function needs to update.
  const result = await passcreatorFetch(e, '/api/v2/pass-template', {
    method: 'POST',
    body,
  });
  // V2 envelope puts the new template id at `data.identifier`. Read
  // it through the shared extractor (also handles legacy top-level
  // `id` for compatibility with test doubles / older responses). If
  // neither path yields a non-empty string, surface the full body in
  // the BadGatewayError so the operator can see what Passcreator sent
  // — empty `data`, unexpected nesting, or a 2xx error envelope are
  // all signposted this way.
  const id = extractTemplateId(result);
  if (id === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `create response missing id (expected data.identifier): ${JSON.stringify(result)}`,
    });
  }
  return { id };
}

/**
 * Update an existing Passcreator template by id.
 *
 * V2 endpoint: `POST /api/v2/pass-template/{identifier}` — **not PUT**.
 *
 * Per the canonical V2 docs (update-a-template.md, 2026-10-11):
 *   > POST /api/v2/pass-template/{identifier}
 *   > Update an existing pass template.
 *
 * Passcreator V2 standardized ALL mutating endpoints on POST (different
 * paths distinguish create vs update). Earlier V1 used
 * `PUT /api/pass-template/[id]` — mixing V1's PUT convention with V2's
 * path produces a 404 + nginx HTML page (the route doesn't exist for
 * PUT), which we surfaced on 2026-10-12 production push as
 * "Passcreator sync failed" with kind:'invalid_response'.
 *
 * The conformance test below (`uses POST method (V2 endpoint
 * convention)`) pins this behavior so future refactors don't drift
 * back to the V1 PUT convention.
 *
 * Idempotent: a no-op update (same body) returns 200 with the existing
 * record. POST here is per Passcreator's design — not from REST
 * semantics — and re-submitting the same body is documented as safe.
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
    `/api/v2/pass-template/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'POST', body },
  );
  // Same V2 envelope as create: id lives at `data.identifier`. If the
  // extractor doesn't find a usable id, treat the update as accepted —
  // we already issued the request with the explicit id, so it is
  // the source of truth. This covers two legitimate cases:
  //   - 204 No Content (empty body → `result === null`)
  //   - 2xx body that omits `data.identifier` (observed in the wild;
  //     some Passcreator envelope shapes on the update verb lack the
  //     id slot)
  // Falling back to the requested id keeps the sync idempotent and
  // matches the prior behavior. We only `throw` when the request
  // fails upstream (handled by `passcreatorFetch` itself), not when
  // the response envelope is simply id-less.
  const extracted = extractTemplateId(result);
  if (extracted !== null) {
    return { id: extracted };
  }
  return { id: passcreatorTemplateId };
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
    `/api/v2/pass-template/${encodeURIComponent(passcreatorTemplateId)}`,
    { method: 'GET' },
  );
}
