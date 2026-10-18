/**
 * Unit tests for shared/lib/passcreator (Passcreator V2 REST client).
 *
 * @module shared/lib/passcreator.test
 *
 * Conformance tests pin the client contract:
 *   - 2xx → returns the `id` from the parsed JSON (or null body passthrough).
 *   - non-2xx → throws BadGatewayError with the right `upstream`, `upstreamStatus`,
 *     and truncated `upstreamBody`.
 *   - network failure (fetch throws) → throws BadGatewayError with the network
 *     error message wrapped.
 *   - non-JSON body on 2xx → throws BadGatewayError (catches the
 *     "server sent junk" case).
 *
 * Rule references:
 *   - Rule 000 § Part C.3 — the wrapper must convert upstream errors to
 *     SaomeError at the boundary.
 *   - Rule 037 § 5 — `vi.stubGlobal('fetch', ...)` is the runtime isolation
 *     technique (avoids touching the real network).
 *
 * @see apps/backend/src/shared/lib/saomeError.ts (BadGatewayError contract).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPassTemplate,
  updatePassTemplate,
  fetchPassTemplate,
  issuePass,
  getPassByIdentifier,
  listPasses,
} from './passcreator';
import { BadGatewayError } from './saomeError';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';

/**
 * Repository root, computed from this test file's location so the
 * v3-fix capture-fixture test can resolve
 * `fixtures/passcreator/v3/v3-create-success.json` without hard-coding
 * absolute paths. Mirrors `apps/backend/scripts/capture-passcreator-v3.cjs::REPO_ROOT`.
 */
const REPO_ROOT = nodePath.resolve(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
);

/**
 * Minimal Passcreator env shape that the client reads via `requireEnv`.
 */
const VALID_ENV = {
  PASSCREATOR_API_URL: 'https://app.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
};

/**
 * Minimal template body — fields unused by these tests are defaulted.
 *
 * Mirrors the real `PasscreatorTemplateBody` shape that
 * `passTemplateMapping.ts` produces (the required-field contract
 * Passcreator enforces — see `passcreator.ts` docblock):
 *   - `type: 'storeCard'`                  — required Passcreator field
 *   - `colors.* ` with `#RRGGBB`            — required regex `^#([A-Fa-f0-9]{6}|...)`
 *   - `barcode.value` + `useAutoIdForValue` — user-requested defaults (2026-10-11)
 *   - `fields.*[].type`                    — required alongside `label` and `value`
 */
function makeBody(overrides: Partial<{ name: string }> = {}) {
  return {
    passTypeId: VALID_ENV.PASSCREATOR_PASS_TYPE_ID,
    type: 'storeCard' as const,
    name: overrides.name ?? 'Café Rewards',
    description: 'desc',
    organizationName: 'Café Co.',
    colors: { backgroundColor: '#0F0F23', foregroundColor: '#F8FAFC' },
    barcode: {
      format: 'PKBarcodeFormatQR' as const,
      value: '',
      useAutoIdForValue: true,
    },
    images: {},
    fields: {
      headerFields: [],
      primaryFields: [],
      secondaryFields: [],
      backFields: [],
    },
  };
}

/**
 * Build a mocked fetch response that mirrors the parts of the Web
 * Response API that the client uses (status, ok, text, json).
 *
 * Tests usually need to assert against URL + method + headers — we
 * return both the fetch implementation AND a call-recorder spy so
 * each test can inspect what got sent.
 */
function makeResponse({
  status = 200,
  body,
}: {
  status?: number;
  body?: string | object | null;
}) {
  const text = typeof body === 'string' ? body : body == null ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
  };
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Passcreator client — env validation', () => {
  it('createPassTemplate throws when PASSCREATOR_API_URL is missing', async () => {
    await expect(
      createPassTemplate({ PASSCREATOR_API_KEY: 'k', PASSCREATOR_PASS_TYPE_ID: 'p' }, makeBody()),
    ).rejects.toThrow(/PASSCREATOR_API_URL/);
  });
  it('createPassTemplate throws when PASSCREATOR_API_KEY is missing', async () => {
    await expect(
      createPassTemplate({ PASSCREATOR_API_URL: 'https://x', PASSCREATOR_PASS_TYPE_ID: 'p' }, makeBody()),
    ).rejects.toThrow(/PASSCREATOR_API_KEY/);
  });
  it('createPassTemplate throws when PASSCREATOR_PASS_TYPE_ID is missing', async () => {
    await expect(
      createPassTemplate({ PASSCREATOR_API_URL: 'https://x', PASSCREATOR_API_KEY: 'k' }, makeBody()),
    ).rejects.toThrow(/PASSCREATOR_PASS_TYPE_ID/);
  });
});

describe('Passcreator client — createPassTemplate', () => {
  /**
   * The V2 envelope (per Passcreator API docs + live capture
   * 2026-10-12) returns the new template id at `data.identifier`,
   * not at top-level `id`. This was a regression in production —
   * two template pushes returned the V2 envelope but the parser
   * looked at top-level `id` and surfaced "create response
   * missing id" to the frontend banner. The next three tests
   * pin the V2 contract from three angles:
   *   1. `returns data.identifier from the V2 envelope` — happy
   *      path with the real shape.
   *   2. `falls back to top-level id when data.identifier missing
   *      (legacy)` — legacy / test-double compatibility.
   *   3. `live V2 envelope shape (regression 2026-10-12)` —
   *      exact bytes from a production response.
   */
  it('returns data.identifier from the V2 envelope (happy path)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 201,
        body: {
          success: true,
          description: 'Template was created successfully!',
          errors: [],
          data: { identifier: 'pc-v2-123' },
          statusCode: 201,
        },
      }),
    );
    const result = await createPassTemplate(VALID_ENV, makeBody());
    expect(result).toEqual({ id: 'pc-v2-123' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://app.passcreator.com/api/v2/pass-template');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const headers = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });
  it('falls back to top-level id when data.identifier is missing (legacy / test-double)', async () => {
    // Some test doubles / older Passcreator responses put `id` at
    // the top level. We accept that for robustness, but the V2
    // envelope path is exercised by the test above.
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 201, body: { id: 'pc-legacy' } }));
    const result = await createPassTemplate(VALID_ENV, makeBody());
    expect(result).toEqual({ id: 'pc-legacy' });
  });
  it('strips trailing slash from API URL', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 201,
        body: { success: true, data: { identifier: 'pc-1' }, errors: [], statusCode: 201 },
      }),
    );
    await createPassTemplate({ ...VALID_ENV, PASSCREATOR_API_URL: 'https://app.passcreator.com/' }, makeBody());
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://app.passcreator.com/api/v2/pass-template');
  });
  it('live V2 envelope shape (regression — 2026-10-12 production push)', async () => {
    // Captured 2026-10-12 against the real endpoint. Two SAOME
    // templates (85b855a5 + c23e1a46) returned this shape; the
    // frontend banner showed "create response missing id" even
    // though the template was successfully created upstream. This
    // test pins the exact bytes the live endpoint returns so future
    // Passcreator envelope changes are caught.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 201,
        body: {
          success: true,
          description: 'Template was created successfully!',
          errors: [],
          data: {
            identifier: '85b855a5-ec86-4fd6-a48e-892ed143ae0f',
          },
          statusCode: 201,
        },
      }),
    );
    const result = await createPassTemplate(VALID_ENV, makeBody());
    expect(result).toEqual({ id: '85b855a5-ec86-4fd6-a48e-892ed143ae0f' });
  });
  it('throws BadGatewayError when response is missing id (neither data.identifier nor top-level id)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          description: 'OK',
          errors: [],
          data: [],   // ← empty array, not an object with identifier
          statusCode: 200,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      // The upstreamBody must surface what was actually returned, so
      // operators can spot envelope-shape drift without re-running.
      expect(String(bge.details?.upstreamBody ?? '')).toContain('create response missing id');
    }
  });
  it('throws BadGatewayError when body is non-JSON', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: '<html>oops</html>' }));
    await expect(createPassTemplate(VALID_ENV, makeBody())).rejects.toBeInstanceOf(BadGatewayError);
  });
  it('throws BadGatewayError on non-2xx with status propagated to details', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 502, body: { error: 'bad' } }));
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.status).toBe(502);
      expect(bge.code).toBe('BAD_GATEWAY');
      expect(bge.details?.upstream).toBe('passcreator');
      expect(bge.details?.upstreamStatus).toBe(502);
    }
  });
  it('throws BadGatewayError on network failure (DNS / connection refused)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));
    await expect(createPassTemplate(VALID_ENV, makeBody())).rejects.toBeInstanceOf(BadGatewayError);
  });
  it('throws BadGatewayError on AbortSignal timeout', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('The operation was aborted'));
    await expect(createPassTemplate(VALID_ENV, makeBody())).rejects.toBeInstanceOf(BadGatewayError);
  });
});

describe('Passcreator client — updatePassTemplate', () => {
  it('returns data.identifier from the V2 envelope (happy path)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          description: 'Template was updated successfully!',
          errors: [],
          data: { identifier: '85b855a5-ec86-4fd6-a48e-892ed143ae0f' },
          statusCode: 200,
        },
      }),
    );
    const result = await updatePassTemplate(VALID_ENV, '85b855a5-ec86-4fd6-a48e-892ed143ae0f', makeBody());
    expect(result.id).toBe('85b855a5-ec86-4fd6-a48e-892ed143ae0f');
  });
  it('returns existing id when id matches the requested one (fall-through when no envelope returned)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-existing' } }));
    const result = await updatePassTemplate(VALID_ENV, 'pc-existing', makeBody());
    expect(result.id).toBe('pc-existing');
  });
  it('encodes the id in the URL (URL-safe)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: { success: true, data: { identifier: 'pc-with spaces' }, errors: [], statusCode: 200 },
      }),
    );
    await updatePassTemplate(VALID_ENV, 'pc-with spaces', makeBody());
    // Space should be encoded as %20 (or +); both are technically valid.
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/\/api\/v2\/pass-template\/pc-with(%20|\+)spaces$/);
  });
  it('uses POST method (V2 endpoint convention — regression 2026-10-12)', async () => {
    // Passcreator V2 update is `POST /api/v2/pass-template/{identifier}`,
    // NOT PUT. The V1 API used `PUT /api/pass-template/[id]` which we
    // mistakenly carried over into the V2 path — Passcreator's edge /
    // nginx returned a 404 + lang="de" HTML page (route does not exist
    // for PUT), surfaced to the SAOME user as "Passcreator sync failed
    // (service temporarily unavailable)". This test pins POST.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: { success: true, data: { identifier: 'pc-1' }, errors: [], statusCode: 200 },
      }),
    );
    await updatePassTemplate(VALID_ENV, 'pc-1', makeBody());
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    // Pin path + method together so a future refactor that flips PUT
    // back doesn't silently regress.
    expect(url).toBe('https://app.passcreator.com/api/v2/pass-template/pc-1');
  });
  it('falls back to existing id when response body is empty (e.g. 204 No Content)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 204, body: null }));
    const result = await updatePassTemplate(VALID_ENV, 'pc-existing', makeBody());
    expect(result.id).toBe('pc-existing');
  });
  it('falls back to existing id when success envelope has data: [] (no id anywhere)', async () => {
    // Edge case: update succeeds but Passcreator returns the success
    // envelope without `data.identifier` (e.g. an upstream glitch).
    // We treat this as "update accepted" and return the existing id.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          description: 'OK',
          errors: [],
          data: [],
          statusCode: 200,
        },
      }),
    );
    const result = await updatePassTemplate(VALID_ENV, 'pc-existing', makeBody());
    expect(result.id).toBe('pc-existing');
  });
  it('throws BadGatewayError on 5xx upstream', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 503, body: 'unavailable' }));
    await expect(updatePassTemplate(VALID_ENV, 'pc-1', makeBody())).rejects.toBeInstanceOf(BadGatewayError);
  });
});

describe('Passcreator client — fetchPassTemplate', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-1', name: 'X' } }));
    const result = await fetchPassTemplate(VALID_ENV, 'pc-1');
    expect(result).toEqual({ id: 'pc-1', name: 'X' });
  });
  it('throws BadGatewayError on upstream 404 (we map all upstream errors to 502)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 404, body: 'not found' }));
    try {
      await fetchPassTemplate(VALID_ENV, 'pc-missing');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      expect((err as BadGatewayError).details?.upstreamStatus).toBe(404);
    }
  });
  it('uses GET method', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-1' } }));
    await fetchPassTemplate(VALID_ENV, 'pc-1');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });
});

describe('Passcreator client — V2 errors[] extraction (regression — 2026-10-11)', () => {
  /**
   * Passcreator V2 returns a JSON error envelope on 4xx/5xx with a
   * structured `errors[]` array. The frontend banner can use this to
   * show "which field is wrong" hints instead of dumping the whole
   * JSON into the upstream body.
   *
   * Real response from production Passcreator (captured 2026-10-11):
   *   POST /api/v2/pass-template with `{"name":"Test"}` → 400
   *   → see the `passcreator-err-2.json` fixture in workspace root
   */
  it('extracts errors[] from 400 into BadGatewayError.details.upstreamErrors', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'The provided JSON was invalid.',
          errors: [
            { property: 'description', message: 'The property description is required' },
            { property: 'type', message: 'The property type is required' },
          ],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'description', message: 'The property description is required' },
        { property: 'type', message: 'The property type is required' },
      ]);
      // upstreamBody stays as-is for the full-JSON fallback display
      expect(String(bge.details?.upstreamBody ?? '')).toContain('"description":"The provided JSON was invalid."');
    }
  });

  it('extracts errors[] from a SINGLE-OBJECT envelope (Passcreator uses both array and object forms)', async () => {
    // 2026-10-11 v6 capture: when Passcreator validates a single
    // thing wrong (e.g. passTypeId not known), it returns:
    //   errors: { property: 'passTypeId', message: '...' }
    // — a singular object, NOT an array. The client must normalize
    // both shapes into the `upstreamErrors` array for the frontend
    // banner.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'The given pass type ID xxx is not known.',
          errors: { property: 'passTypeId', message: 'This pass type ID is not known.' },
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'passTypeId', message: 'This pass type ID is not known.' },
      ]);
      expect(bge.details?.kind).toBe('upstream_rejected');
    }
  });

  it('does NOT add upstreamErrors when errors[] is empty (no false positive)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Some error without per-field details',
          errors: [],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      const bge = err as BadGatewayError;
      // Empty errors[] → don't surface an empty array; just keep upstreamBody
      expect(bge.details?.upstreamErrors).toBeUndefined();
    }
  });

  it('filters out malformed error entries (non-{property, message} objects)', async () => {
    // Passcreator might return entries with non-string property/message,
    // or junk entries from upstream intermediaries. We keep only
    // well-formed {property: string, message: string} pairs.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Some error',
          errors: [
            { property: 'name', message: 'is required' },
            'not-an-object',
            null,
            { property: 123, message: 'wrong type for property' },
            { foo: 'bar' },
            { property: 'desc', message: 'is required' },
          ],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      const bge = err as BadGatewayError;
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'name', message: 'is required' },
        { property: 'desc', message: 'is required' },
      ]);
    }
  });

  it('does NOT extract errors[] from a 2xx response (success envelope is distinct)', async () => {
    // Per V2 docs, success responses also have `errors: []`. We must
    // not mistakenly treat a 2xx-with-errors as an error envelope.
    // Uses the actual V2 success envelope shape (data.identifier),
    // not a synthetic top-level `id` — this matches what the live
    // endpoint returns.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          description: 'OK',
          errors: [],
          data: { identifier: 'pc-1' },
          statusCode: 200,
        },
      }),
    );
    const result = await createPassTemplate(VALID_ENV, makeBody());
    expect(result.id).toBe('pc-1');
    // No throw, no upstreamErrors surfaced (this test only exercises
    // the no-extraction-on-2xx branch).
  });

  it('does NOT extract errors[] from a non-2xx response WITHOUT success:false (defensive)', async () => {
    // Some non-2xx responses (e.g. 5xx with a generic error body) may
    // have an `errors` field that doesn't conform to the V2 envelope.
    // We must not extract from those — only from envelopes with
    // `success === false` AND `Array.isArray(errors)`.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 503,
        body: { error: 'unavailable', errors: [{ property: 'x', message: 'y' }] },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      const bge = err as BadGatewayError;
      // success is not false → no extraction
      expect(bge.details?.upstreamErrors).toBeUndefined();
      // upstreamBody still has the raw JSON (truncated per the existing rule)
      expect(String(bge.details?.upstreamBody ?? '')).toContain('"errors"');
    }
  });

  it('extracts errors[] from update 400 (POST updatePassTemplate — regression 2026-10-12)', async () => {
    // V2 update uses POST. Same envelope shape as create — verify the
    // extraction works for the update verb.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Invalid data.',
          errors: [{ property: 'colors', message: 'The property colors is required' }],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await updatePassTemplate(VALID_ENV, 'pc-1', makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      const bge = err as BadGatewayError;
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'colors', message: 'The property colors is required' },
      ]);
    }
  });
});

describe('Passcreator client — error kind categorization (regression — 2026-10-11)', () => {
  /**
   * The 502 the client throws can have 3 distinct underlying causes,
   * each requiring different user-facing copy:
   *
   *   - `network`           — fetch threw (DNS / connection refused / TLS
   *                            / timeout). Likely a transient network blip;
   *                            the user can retry.
   *   - `invalid_response`  — we got a response but the body is not the
   *                            expected JSON shape. Typically a CDN edge
   *                            error (Cloudflare 5xx HTML page, e.g. 530
   *                            "Origin DNS error" / code 1016) — the
   *                            upstream is unreachable from the edge.
   *   - `upstream_rejected` — we got a structured V2 error envelope
   *                            (success: false, errors: [...]). Passcreator
   *                            explicitly rejected the data.
   *
   * Without this discriminator, the banner had a single "check your
   * network connection" message that misled users into thinking their
   * own network was broken when actually it was Passcreator's edge.
   */
  it('sets kind="network" when fetch throws (DNS / connection refused)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('network');
      // No upstreamStatus — the request never reached the wire.
      expect(bge.details?.upstreamStatus).toBeUndefined();
    }
  });

  it('sets kind="invalid_response" for non-2xx with non-JSON body (Cloudflare 530 / 1016 regression)', async () => {
    // 2026-10-11 — the bug that triggered this work. Cloudflare edge
    // returns 530 + a non-JSON body like `error code: 1016` (Origin
    // DNS error) when it can't reach the Passcreator origin. The
    // banner must NOT tell the user "check your network" — it's
    // Passcreator's origin that's unreachable, not the user's network.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 530, body: 'error code: 1016' }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('invalid_response');
      expect(bge.details?.upstreamStatus).toBe(530);
      // upstreamBody still has the raw text for debugging.
      expect(String(bge.details?.upstreamBody ?? '')).toContain('error code: 1016');
      // No upstreamErrors — body wasn't a V2 envelope.
      expect(bge.details?.upstreamErrors).toBeUndefined();
    }
  });

  it('sets kind="upstream_rejected" for non-2xx with V2 error envelope', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'The provided JSON was invalid.',
          errors: [{ property: 'description', message: 'is required' }],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('upstream_rejected');
      // upstreamErrors still populated for the field list.
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'description', message: 'is required' },
      ]);
    }
  });
});

describe('Passcreator client — error envelope contract', () => {
  it('truncates a long upstream body to ≤ 500 chars + suffix', async () => {
    // Build a JSON body whose stringified form exceeds 500 chars.
    // The client stringifies object bodies before packing into BadGatewayError.
    const longMessage = 'X'.repeat(2000);
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 500, body: { error: longMessage } }),
    );
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      const bge = err as BadGatewayError;
      const body = String(bge.details?.upstreamBody ?? '');
      // Total = 500 (slice) + 15 ('... (truncated)')
      expect(body.length).toBe(515);
      expect(body.endsWith('... (truncated)')).toBe(true);
    }
  });
});

/**
 * Live-capture fixture shape tests.
 *
 * The fixtures under `fixtures/passcreator/*.json` are produced by
 *   `node apps/backend/scripts/capture-passcreator-errors.cjs`
 * which runs 4 hand-crafted failing requests against the real
 * Passcreator V2 API and saves the responses. They pin the V2
 * envelope shape so future Passcreator API changes are caught by
 * the `passes V2 shape pin` tests below.
 *
 * If the fixtures are absent (capture script not yet run), the tests
 * register as `skip` rather than fail — capture is opt-in, not a
 * CI gate. Run the script on a machine with network access to
 * `app.passcreator.com` to generate them.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);
// `import.meta.url` resolves differently depending on the vitest pool:
//   - `npx vitest run <absolute-path>` (workerd pool direct): `__dirname`
//     is the test file's directory → 5 levels of `../` lands at the repo root.
//   - `npm test` (workspace pool with wrangler config): the workerd isolate
//     resolves `__dirname` to a `/C:/...` (forward-slash prefixed) path.
// The capture script (`apps/backend/scripts/capture-passcreator-errors.cjs`)
// writes to `<repo-root>/fixtures/passcreator/`.
//
// IMPORTANT: `@cloudflare/vitest-pool-workers` runs the suite inside
// workerd, which does NOT implement `fs.readFileSync` (throws
// "readFileSync() is not yet implemented in Workers") and likewise for
// `statSync` / `existsSync`. Any tryLoadFixture() that goes through
// `fs` is therefore a no-op under the workspace pool. Two ways to load
// the fixtures that DO work in workerd:
//   1. Statically import each .json as a Vite module — Vite bundles
//      the JSON contents into the test bundle at build time, so the
//      runtime never touches `fs`. This is what `importFixtures` does
//      below via `import.meta.glob`.
//   2. Skip path: if neither strategy yields a fixture, the test
//      registers as `it.skip` (per the test's pre-existing contract).
importFixturesGlob();
function importFixturesGlob(): Record<string, CapturedFixture> {
  try {
    // Vite-specific glob: bundle every JSON file matching the path.
    // `eager: true` returns the parsed contents directly (no Promise).
    // The path is `../../../../../fixtures/passcreator/*.json` from
    // this test file (5 levels of `../` to climb out of
    // `apps/backend/src/shared/lib/` to the repo root).
    //
    // We glob two path patterns so both top-level V2 fixtures
    // (`success-create.json` etc.) and V3 sub-folder fixtures
    // (`v3/v3-create-success.json` etc.) are bundled. The key
    // derivation below preserves the `v3/...` prefix so callers
    // use `tryLoadFixture('v3/v3-create-success')` to opt into a
    // V3 fixture without colliding with V2's `success-create`.
    const modules = import.meta.glob<CapturedFixture>(
      [
        '../../../../../fixtures/passcreator/*.json',
        '../../../../../fixtures/passcreator/v3/*.json',
      ],
      { eager: true },
    );
    const out: Record<string, CapturedFixture> = {};
    for (const path of Object.keys(modules)) {
      const mod = modules[path];
      // V3 sub-folder: key includes the `v3/` prefix so it doesn't
      // collide with V2 top-level filenames.
      const m3 = path.match(/\/v3\/([^/]+)\.json$/);
      if (m3) {
        out[`v3/${m3[1]}`] = mod;
        continue;
      }
      // V2 top-level: key is the basename only.
      const m2 = path.match(/\/([^/]+)\.json$/);
      if (m2) out[m2[1]] = mod;
    }
    return out;
  } catch {
    return {};
  }
}
const FIXTURES_DIR_CANDIDATES: string[] = (() => {
  const candidates: string[] = [];
  candidates.push(nodePath.resolve(__dirname, '../../../../../fixtures/passcreator'));
  candidates.push(nodePath.resolve(__dirname, '../../../../fixtures/passcreator'));
  let cursor = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(nodePath.join(cursor, 'fixtures', 'passcreator'));
    const parent = nodePath.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return candidates;
})();

interface CapturedFixture {
  scenario: string;
  description: string;
  capturedAt: string;
  apiUrl: string;
  request: { method: string; path: string; body: unknown };
  response: { status: number; ok: boolean; contentType: string | null; body: unknown };
}

const STATIC_FIXTURES = importFixturesGlob();
function tryLoadFixture(scenario: string): CapturedFixture | null {
  // Strategy 1: static import via Vite `import.meta.glob` — works inside
  // workerd because the JSON is bundled at build time.
  const fromGlob = STATIC_FIXTURES[scenario];
  if (fromGlob) return fromGlob;
  // Strategy 2: runtime read via `fs` — works under `npx vitest run`
  // (Node) but NOT under the workspace `npm test` (workerd pool).
  for (const dir of FIXTURES_DIR_CANDIDATES) {
    const filePath = nodePath.join(dir, `${scenario}.json`);
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(text) as CapturedFixture;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function isV2ErrorEnvelope(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  if (obj.success !== false) return false;
  const errors = obj.errors;
  // V2 envelope has either `errors: [{...}]` (array) or
  // `errors: { property, message }` (singular object — verified
  // 2026-10-11 in the `invalid-pass-type-id` scenario).
  if (Array.isArray(errors)) return true;
  if (typeof errors === 'object' && errors !== null) {
    const e = errors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') return true;
  }
  return false;
}

function extractUpstreamErrorsLikeClient(parsed: unknown): Array<{ property: string; message: string }> {
  if (!isV2ErrorEnvelope(parsed)) return [];
  const errors = (parsed as { errors: unknown }).errors;
  if (Array.isArray(errors)) {
    return errors.flatMap((entry): Array<{ property: string; message: string }> => {
      if (typeof entry !== 'object' || entry === null) return [];
      const e = entry as Record<string, unknown>;
      if (typeof e.property !== 'string' || typeof e.message !== 'string') return [];
      return [{ property: e.property, message: e.message }];
    });
  }
  // Singular-object case
  if (typeof errors === 'object' && errors !== null) {
    const e = errors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') {
      return [{ property: e.property, message: e.message }];
    }
  }
  return [];
}

// Module-level helper used by both the success-fixture describe
// (added 2026-10-12 for the id-parse regression) and the error-fixture
// describe (added 2026-10-11 for the envelope-shape capture). Each
// returns the captured `CapturedFixture | null` so callers can pick
// `it` or `it.skip` based on whether the fixture exists.
const fixtureOrSkip = (scenario: string) => tryLoadFixture(scenario);

describe('Passcreator client — live V2 SUCCESS fixture (regression — 2026-10-12 id-parse bug)', () => {
  /**
   * Captured 2026-10-12 against the real endpoint. Two production
   * pushes (`85b855a5-...` and `c23e1a46-...`) returned 201 with the
   * V2 success envelope below, but the parser read top-level `id`
   * (undefined) and surfaced "create response missing id" to the
   * user. Pinning this fixture prevents future envelope-shape drift
   * from silently breaking the publish flow.
   */
  const fixture = fixtureOrSkip('success-create');

  describe('scenario: success-create (POST with full template body → 201 with data.identifier)', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 201 status and the V2 success envelope', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(201);
      const body = fixture!.response.body as { success?: unknown; data?: unknown };
      expect(body.success).toBe(true);
      expect(typeof body.data).toBe('object');
      expect((body.data as { identifier?: unknown })?.identifier).toBe(
        '85b855a5-ec86-4fd6-a48e-892ed143ae0f',
      );
    });

    itFixture('client extracts data.identifier and returns { id } (regression — 2026-10-12 production push)', async () => {
      // This is the end-to-end check that the publish flow needs:
      // feed the exact bytes Passcreator sent in production, and
      // assert the parser surfaces the id correctly. Before the fix
      // the parser threw `create response missing id` here.
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      const result = await createPassTemplate(VALID_ENV, makeBody());
      expect(result.id).toBe('85b855a5-ec86-4fd6-a48e-892ed143ae0f');
    });

    itFixture('client surfaces an upstreamBody hint when the envelope lacks an id (defensive)', async () => {
      // Passcreator 2026-10-12 also returned an envelope with `data: []`
      // (empty array, not the success-object). The parser correctly
      // throws `BadGatewayError` with a hint pointing to the expected
      // `data.identifier` location.
      fetchSpy.mockResolvedValueOnce(
        makeResponse({
          status: 201,
          body: {
            success: true,
            description: 'Template was created successfully!',
            errors: [],
            data: [],
            statusCode: 201,
          },
        }),
      );
      try {
        await createPassTemplate(VALID_ENV, makeBody());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadGatewayError);
        const bge = err as BadGatewayError;
        expect(String(bge.details?.upstreamBody ?? '')).toContain('expected data.identifier');
      }
    });
  });
});

describe('Passcreator client — live V2 error fixtures (regression — 2026-10-11 capture)', () => {
  /**
   * Each `it` below either runs (when the fixture file exists) or
   * registers as `skip` (when it doesn't). The skip path keeps
   * CI green before the capture script has been run; the run path
   * asserts the V2 envelope shape hasn't drifted.
   */

  describe('scenario: empty-body (POST {} → multi-field V2 errors[])', () => {
    const fixture = fixtureOrSkip('empty-body');
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with the V2 envelope shape', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBeGreaterThanOrEqual(400);
      expect(fixture!.response.status).toBeLessThan(500);
      expect(isV2ErrorEnvelope(fixture!.response.body)).toBe(true);
    });

    itFixture('extractUpstreamErrors pulls out well-formed {property, message} entries', () => {
      const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
      // Empty body should surface at least one error (Passcreator is
      // strict about required fields). The exact field set is allowed
      // to drift between Passcreator versions — we only assert the
      // extraction logic, not the count.
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        // Real V2 envelopes MAY carry an empty `property` string for
        // envelope-level (root) errors — e.g. Passcreator's
        // `{"property":"","message":"Array value found, but an object is required"}`
        // when the entire request body is an empty object. We only
        // require the values to be strings, not non-empty.
        expect(typeof entry.property).toBe('string');
        expect(typeof entry.message).toBe('string');
        expect(entry.message.length).toBeGreaterThan(0);
      }
    });

    itFixture('client correctly extracts errors[] when mock returns the fixture body', async () => {
      // The end-to-end client behavior check: feed the captured
      // envelope through the real client and assert the
      // BadGatewayError shape that comes out.
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      try {
        await createPassTemplate(VALID_ENV, makeBody());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadGatewayError);
        const bge = err as BadGatewayError;
        expect(bge.details?.kind).toBe('upstream_rejected');
        expect(bge.details?.upstreamStatus).toBe(fixture!.response.status);
        const upstreamErrors = bge.details?.upstreamErrors as Array<{ property: string; message: string }> | undefined;
        expect(upstreamErrors).toBeDefined();
        expect(upstreamErrors!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('scenario: invalid-pass-type-id (POST with bogus passTypeId)', () => {
    const fixture = fixtureOrSkip('invalid-pass-type-id');
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists and the response is a 4xx (validation error)', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBeGreaterThanOrEqual(400);
      expect(fixture!.response.status).toBeLessThan(500);
      // As of v6 (2026-10-11), this scenario returns a SINGLE-OBJECT
      // `errors` field (not an array). The client normalizes both
      // shapes — this test pins the v6-fixture shape.
      expect(isV2ErrorEnvelope(fixture!.response.body)).toBe(true);
    });

    itFixture('client extracts the singular errors object as a 1-entry upstreamErrors (regression — v6 fixture)', () => {
      // v6 fixture has:
      //   errors: { property: 'passTypeId', message: 'This pass type ID is not known.' }
      // — singular object. The client's normalizePasscreatorErrorEntries
      // helper wraps it into [entry] so the frontend banner can render
      // uniformly. This test fails if either:
      //   (a) client treats singular object as `invalid_response`
      //       (the would-be v5 behavior — bug fix).
      //   (b) client drops the singular entry silently.
      if (Array.isArray((fixture!.response.body as { errors: unknown }).errors)) {
        // If the upstream switched back to array form in the future,
        // the client should still extract — accept either shape.
        const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
        expect(entries.some((e) => e.property === 'passTypeId')).toBe(true);
      } else {
        // Singular-object form (the v6 fix scenario)
        const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
        expect(entries).toEqual([
          { property: 'passTypeId', message: 'This pass type ID is not known.' },
        ]);
      }
    });

    itFixture('end-to-end: client surfaces singular-object errors[] as upstreamErrors', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      try {
        await createPassTemplate(VALID_ENV, makeBody());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadGatewayError);
        const bge = err as BadGatewayError;
        expect(bge.details?.kind).toBe('upstream_rejected');
        const upstreamErrors = bge.details?.upstreamErrors as Array<{ property: string; message: string }> | undefined;
        expect(upstreamErrors).toBeDefined();
        expect(upstreamErrors!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('scenario: bad-token (POST with wrong Authorization)', () => {
    const fixture = fixtureOrSkip('bad-token');
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 401 (or 403) status', () => {
      expect(fixture).not.toBeNull();
      // Passcreator may return 401 or 403 depending on their auth
      // pipeline. Both are acceptable; we just need the response to
      // be an auth failure (not a 5xx).
      expect([401, 403]).toContain(fixture!.response.status);
    });

    itFixture('client assigns kind="upstream_rejected" if V2 envelope, otherwise "invalid_response"', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      try {
        await createPassTemplate(VALID_ENV, makeBody());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadGatewayError);
        const bge = err as BadGatewayError;
        // Both branches are valid depending on Passcreator's auth
        // implementation: if they return a V2 JSON envelope, we
        // extract `upstream_rejected`; if they return a plain text
        // or HTML body (e.g. a CDN 401), we surface
        // `invalid_response` instead.
        expect(['upstream_rejected', 'invalid_response']).toContain(bge.details?.kind);
        // Auth-failed responses must NEVER contain the actual API
        // key in the error message — the test fixture must already
        // be redacted. We assert the body doesn't echo our fake
        // token either.
        const bodyText = JSON.stringify(fixture!.response.body);
        expect(bodyText).not.toContain('wrong-key-capture-test');
      }
    });
  });

  describe('scenario: wrong-format-field (POST with colors: string)', () => {
    const fixture = fixtureOrSkip('wrong-format-field');
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 4xx status and V2 envelope', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBeGreaterThanOrEqual(400);
      expect(fixture!.response.status).toBeLessThan(500);
      expect(isV2ErrorEnvelope(fixture!.response.body)).toBe(true);
    });

    itFixture('errors[] mentions the "colors" field', () => {
      const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
      expect(entries.length).toBeGreaterThan(0);
      const names = entries.map((e) => e.property);
      // Passcreator might phrase it as `colors` or `colors.backgroundColor`
      // depending on how deep the validation runs.
      const mentions = names.some(
        (n) => /^colors(\.|$)/i.test(n) || n === 'colors',
      );
      expect(mentions).toBe(true);
    });
  });
});

// ============================================================================
// 2026-10-17 — Passcreator V3 LIVE fixtures (regression — `capture-passcreator-v3.cjs`)
//
// The 3 fixtures below were produced by
//   `node apps/backend/scripts/capture-passcreator-v3.cjs`
// which hits the REAL `https://app.passcreator.com/api/v3/pass` endpoint
// with a real API key + a real V2 template (production `b5386504-...`)
// and saves the responses. They pin the LIVE V3 envelope shape so
// future Passcreator API changes are caught by these tests.
//
// Fixture inventory:
//   - v3/v3-create-success.json — POST /api/v3/pass?async=false → 200
//     with `data.{identifier, downloadPage, iPhoneUri, androidUri, barcodeValue}`.
//     `barcodeValue` is the literal string `"no value specified"`
//     when the template has no barcode configured (CONFIRMED Q2 root
//     cause: this literal is what SAOME writes to `pass_holders.barcode_value`).
//   - v3/v3-list.json — GET /api/v3/pass → 200 with paginated `data[]`
//     (100 of 221 passes), cursor-based `page.next`, each item has
//     `linkToPassPage` (NOT `downloadPage` — that field is V3-create only).
//   - v3/v3-create-error.json — POST → 400 with `errors: string[]`
//     (NOT `{property, message}[]` like V2). Passcreator returns
//     `"Template not found!"` whether the templateId is missing OR
//     references a non-existent template.
//
// CONTRACT DRIFTS captured here (see feedback
// `runs/improvements/feedback/20261017-passcreator-v3-capture.md` for
// full analysis):
//   - V3 create response HAS `downloadPage + iPhoneUri + androidUri`
//     (V3 docs § Returned values); V3 LIST response has `linkToPassPage`
//     only (no `downloadPage`). The current `extractPassIssueData`
//     parser handles the CREATE shape correctly (confirmed by this test).
//   - V3 error envelope uses `errors: string[]` (NOT V2's `{property,
//     message}[]`). The current `normalizePasscreatorErrorEntries` only
//     handles object/array of objects — string entries get silently
//     dropped. This is a known TODO for the parser fix (Rule 019 § 4.1
//     contract sync — flagged for next session).
//   - `barcodeValue: "no value specified"` is a LITERAL placeholder
//     string Passcreator returns when no barcode is configured. The
//     current parser passes it through verbatim → `pass_holders.barcode_value`
//     ends up as `"no value specified"` in the DB. Q2 root-cause fix
//     (defensive normalize → null) is flagged for next session.
// ============================================================================

describe('Passcreator client — live V3 SUCCESS fixture (regression — 2026-10-17 capture)', () => {
  /**
   * Captured 2026-10-17 against `https://app.passcreator.com/api/v3/pass?async=false`
   * with a real V2 template (production UUID `b5386504-4a40-4ad3-9ec6-a8fd139e3c2d`)
   * and dummy holder data (`capture-test-1792270086179@capture.invalid` + non-ASCII
   * name `Capture 測試 1792270086179`). This pins the exact bytes Passcreator
   * returns for a real successful per-pass issuance so future envelope-shape drift
   * is caught.
   */
  const fixture = fixtureOrSkip('v3/v3-create-success');

  describe('scenario: v3-create-success (POST /api/v3/pass?async=false → 200 with downloadPage + iPhoneUri + androidUri)', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 200 status and the V3 success envelope (data.{identifier, downloadPage, iPhoneUri, androidUri})', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(200);
      const body = fixture!.response.body as {
        success?: unknown;
        data?: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
      // V3 create response HAS all 5 expected fields
      expect(body.data).toHaveProperty('identifier');
      expect(body.data).toHaveProperty('downloadPage');
      expect(body.data).toHaveProperty('iPhoneUri');
      expect(body.data).toHaveProperty('androidUri');
      // V3 create response does NOT use V1's `linkToPassPage` field
      expect(body.data).not.toHaveProperty('linkToPassPage');
    });

    itFixture('client correctly extracts identifier + downloadPage + iPhoneUri + androidUri + barcodeValue when mock returns the fixture body', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      // The fixture's captured `data` block contains the real production
      // `templateId`; we feed it back to `issuePass` as if we had looked
      // it up from the upstream template. The holder payload mirrors the
      // request body the capture script sent (non-ASCII name tests the
      // workerd JSON.stringify round-trip path).
      const result = await issuePass(
        VALID_ENV,
        'b5386504-4a40-4ad3-9ec6-a8fd139e3c2d',
        {
          name: 'Capture 測試 1792270086179',
          phone: '+886912345678',
          birthday: '1990-01-01',
          email: 'capture-test-1792270086179@capture.invalid',
        },
      );
      // The 5 fields the parser is contracted to return. The exact
      // identifier / URLs come from the live capture — they will
      // shift if Passcreator rotates its URL scheme, but the SHAPE
      // (string fields present, iPhoneUri ends with .pkpass, androidUri
      // is a Passwallet / Google deep link) is what we pin.
      expect(result.identifier).toBe('c2da13bc-2bab-4da8-837d-2857c7e23aee');
      expect(result.downloadPage).toMatch(/^https:\/\/app\.passcreator\.com\/en\/p\//);
      expect(result.iPhoneUri).toMatch(/^https:\/\/app\.passcreator\.com\/.*pkpass/);
      expect(result.androidUri).toMatch(/^https:\/\/(passwallet\.page\.link|pay\.google\.com)/);
      // CRITICAL: Passcreator's live-captured `barcodeValue` when the
      // template has no barcode configured is the LITERAL string
      // `"no value specified"` (per the 2026-10-17 V3 capture).
      // Pre-fix (Q2 root cause) the parser passed this through
      // verbatim → production `pass_holders.barcode_value` was stored
      // as the literal `"no value specified"`. Post-fix, the parser's
      // `normalizeBarcodeValue` helper collapses this sentinel string
      // to `null` — the conformance tests in
      // `"barcodeValue defensive normalize (P0 #3 — 2026-10-17 capture)"`
      // pin all 4 placeholder strings + null + real-value branches.
      // The assertion below documents the post-normalization contract
      // for the live V3 fixture shape.
      expect(result.barcodeValue).toBeNull();
    });
  });
});

describe('Passcreator client — live V3 LIST fixture (regression — 2026-10-17 capture)', () => {
  /**
   * Captured 2026-10-17 against `https://app.passcreator.com/api/v3/pass`
   * (GET). Returns 100 of 221 production passes with cursor-based
   * pagination. Each list item has `linkToPassPage` (NOT `downloadPage`
   * — that's V3-create only). This fixture pins the list envelope shape
   * so any future consumer that hits V3 list (e.g. retention / dashboard)
   * doesn't accidentally assume V3-create field names.
   */
  const fixture = fixtureOrSkip('v3/v3-list');

  describe('scenario: v3-list (GET /api/v3/pass → 200 with paginated data[])', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 200 status, pagination metadata, and an array data field', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(200);
      const body = fixture!.response.body as {
        success?: unknown;
        responseMetaData?: { resultsTotal?: number; resultsThisPage?: number };
        page?: { next?: string };
        data?: unknown[];
      };
      expect(body.success).toBe(true);
      // Pagination metadata is ALWAYS present (even when null on create)
      expect(body.responseMetaData).not.toBeNull();
      expect(body.responseMetaData?.resultsTotal).toBeGreaterThan(0);
      // Cursor-based pagination — `next` is the full URL to fetch the
      // next page; this is NOT offset/page-number style.
      expect(body.page?.next).toMatch(/^https:\/\/app\.passcreator\.com\/api\/v3\/pass\/\?/);
      expect(body.data).toBeInstanceOf(Array);
      expect((body.data as unknown[]).length).toBeGreaterThan(0);
    });

    itFixture('each V3 list item has `linkToPassPage` (NOT `downloadPage` — V3-create field is not in list)', () => {
      const body = fixture!.response.body as { data?: Array<Record<string, unknown>> };
      const firstItem = body.data?.[0];
      expect(firstItem).toBeDefined();
      expect(firstItem).toHaveProperty('linkToPassPage');
      // V3-create-only fields are NOT in list responses
      expect(firstItem).not.toHaveProperty('downloadPage');
      expect(firstItem).not.toHaveProperty('iPhoneUri');
      expect(firstItem).not.toHaveProperty('androidUri');
    });
  });
});

describe('Passcreator client — live V3 ERROR fixture (regression — 2026-10-17 capture)', () => {
  /**
   * Captured 2026-10-17 against `https://app.passcreator.com/api/v3/pass?async=false`
   * (POST) with `data.templateId` intentionally omitted. Passcreator
   * returns 400 with `errors: string[]` (literal `"Template not found!"`)
   * — NOT the `{property, message}[]` shape V2 uses. This is a real
   * envelope drift between V2 and V3 that the parser does NOT currently
   * handle (string entries get silently dropped by
   * `normalizePasscreatorErrorEntries`).
   */
  const fixture = fixtureOrSkip('v3/v3-create-error');

  describe('scenario: v3-create-error (POST /api/v3/pass → 400 with errors: string[])', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 400 status and an array of STRING errors (NOT {property, message}[])', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(400);
      const body = fixture!.response.body as { success?: unknown; errors?: unknown };
      expect(body.success).toBe(false);
      // V3 envelope shape: errors is a string array (NOT objects)
      expect(Array.isArray(body.errors)).toBe(true);
      expect(typeof (body.errors as unknown[])[0]).toBe('string');
      // Confirm the literal error string Passcreator returns
      expect((body.errors as string[])[0]).toContain('Template not found');
    });

    itFixture('V3 string-array errors are wrapped into upstreamErrors (P0 #2 — 2026-10-17 capture)', async () => {
      // After P0 #2 fix: V3 envelope's `errors: string[]` (live-captured
      // 2026-10-17, distinct from V2's `{property, message}[]` shape) is
      // wrapped by `normalizePasscreatorErrorEntries` into
      // `{property: 'data', message: <string>}` entries — one per string.
      // 'data' is the V3 envelope's top-level key (per docs § "The
      // following properties of the `data` object can/must be submitted
      // in the request body"); V3 does NOT include per-field paths in
      // its error entries, so 'data' is the most accurate context prefix.
      //
      // The frontend banner now sees per-message entries instead of an
      // empty array — so the user gets at least the literal message
      // "Template not found!" surfaced (vs. only "Bad request" with no
      // per-field reason).
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      try {
        await issuePass(VALID_ENV, 'b5386504-4a40-4ad3-9ec6-a8fd139e3c2d', makeHolder());
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BadGatewayError);
        const bge = err as BadGatewayError;
        expect(bge.details?.kind).toBe('upstream_rejected');
        expect(bge.details?.upstreamStatus).toBe(400);
        expect(bge.details?.upstreamErrors).toEqual([
          { property: 'data', message: 'Template not found!' },
        ]);
      }
    });
  });
});

// ============================================================================
// 2026-10-18 — P0 #2 V3 error envelope string-array wrap
//
// Live V3 capture (2026-10-17) showed Passcreator's V3 error envelope
// uses `errors: string[]` — distinct from V2's `{property, message}[]`.
// Pre-fix, `normalizePasscreatorErrorEntries` only handled the V2 shapes
// (array-of-objects + singular-object), so V3 string entries got
// silently dropped → frontend banner showed only "Bad request" with
// no per-field reason.
//
// Post-fix, the helper recognizes a `string[]` errors shape (the FIRST
// entry is a string) and maps each entry into `{property: 'data',
// message: <string>}` so the frontend banner can render uniformly.
// Empty strings are filtered out defensively.
//
// 4 tests pin the new behavior:
//   - single string entry → 1-entry upstreamErrors
//   - multiple string entries → each wrapped separately
//   - empty string entries → filtered out
//   - V2 array-of-objects shape → STILL uses property from each entry
//     (regression guard — the V2 path must not regress when we add the
//     string-array branch)
// ============================================================================

describe('Passcreator client — V3 string-array errors defensive wrap (P0 #2 — 2026-10-17 capture)', () => {
  it('single string entry → wrapped as 1-entry upstreamErrors', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Bad request',
          errors: ['Template not found!'],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('upstream_rejected');
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'data', message: 'Template not found!' },
      ]);
    }
  });

  it('multiple string entries → each wrapped as separate upstreamErrors', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Invalid data',
          errors: ['Template not found!', 'Email is invalid', 'Phone format wrong'],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should throw');
    } catch (err) {
      expect((err as BadGatewayError).details?.upstreamErrors).toEqual([
        { property: 'data', message: 'Template not found!' },
        { property: 'data', message: 'Email is invalid' },
        { property: 'data', message: 'Phone format wrong' },
      ]);
    }
  });

  it('empty string entries filtered out (defensive)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Bad request',
          errors: ['Template not found!', '', '  '],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should throw');
    } catch (err) {
      // Empty / whitespace-only entries are filtered — only the
      // non-empty message is surfaced.
      expect((err as BadGatewayError).details?.upstreamErrors).toEqual([
        { property: 'data', message: 'Template not found!' },
      ]);
    }
  });

  it('V2 array-of-objects shape STILL uses property from each entry (regression guard)', async () => {
    // Pre-existing V2 path: errors[] of {property, message} objects.
    // The new string-array branch must NOT regress this — when the
    // first entry is an OBJECT, the helper should fall back to the
    // existing `extractUpstreamErrorsFromArray` path (which preserves
    // each entry's own `property` field).
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Invalid data',
          errors: [
            { property: 'data.email', message: 'is invalid' },
            { property: 'data.phone', message: 'format wrong' },
          ],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should throw');
    } catch (err) {
      // Each entry keeps its own property — NOT collapsed to 'data'.
      expect((err as BadGatewayError).details?.upstreamErrors).toEqual([
        { property: 'data.email', message: 'is invalid' },
        { property: 'data.phone', message: 'format wrong' },
      ]);
    }
  });
});

// ============================================================================
// 2026-10-19 — Passcreator V3 per-pass issuance (`issuePass`)
//
// V3 contract (verified against https://developer.passcreator.com/en/api/v3/pass
// — "Create a Pass" section, captured 2026-10-19):
//
//   - Endpoint: POST https://app.passcreator.com/api/v3/pass?async=false
//   - async URL param defaults to `true`; MUST be `false` for barcodeValue
//     to appear in the response.
//   - Body is wrapped in a `data` object:
//       { "data": { templateId, name, phone, birthday, email, ... } }
//     additional properties (like `name` / `phone` / `birthday` / `email`)
//     go directly inside `data`, NOT under an `additionalPropertyValues`
//     wrapper (that field name does NOT exist on V3 create).
//   - Success response shape:
//       { success, data: { identifier, downloadPage, iPhoneUri,
//                          androidUri, barcodeValue, ... }, statusCode }
//     Note: V3 returns `downloadPage` (not `linkToPassPage` like V1's
//     `linkToPassPage`); `iPhoneUri` and `androidUri` are the direct
//     .pkpass / Google Wallet deeplinks.
//
// Six conformance tests pin the V3 wrapper contract so:
//   1. Happy-path V3 envelope parses correctly.
//   2. Network failure surfaces BadGatewayError(kind='network').
//   3. V3 error envelope surfaces BadGatewayError(kind='upstream_rejected')
//      with the per-field `upstreamErrors[]`.
//   4. Singular-object errors shape is normalized to 1-entry array
//      (same defensive path as V2).
//   5. Response missing both `data.identifier` and top-level id
//      throws BadGatewayError with a hint pointing to V3 envelope.
//   6. Non-ASCII holder name round-trips correctly through JSON
//      serialization (regression — workerd JSON.stringify pitfall).
//
// See runs/decisions/2026-10-19-pass-holder-v3-issuance.md and
// runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md
// (the original mock shape was wrong — V3 docs `additionalPropertyValues`
// wrapper / `linkToPassPage` response field do NOT exist on V3 create).
// ============================================================================

/**
 * V3 minimal holder payload — matches the 4 fields pushed directly
 * into the `data` object (NOT into `additionalPropertyValues`).
 */
function makeHolder(overrides: Partial<{ name: string; phone: string; birthday: string; email: string }> = {}) {
  return {
    name: overrides.name ?? '王小明',
    phone: overrides.phone ?? '+886912345678',
    birthday: overrides.birthday ?? '1990-01-15',
    email: overrides.email ?? 'wang@example.com',
  };
}

/** V3 success envelope — matches the documented shape from V3 docs
 *  (Create a Pass → Returned values section). The real V3 response
 *  has `downloadPage` (universal Passcreator landing page that
 *  device-sniffs Apple vs Google), `iPhoneUri` (direct .pkpass),
 *  `androidUri` (Google Pay / Passwallet deeplink), and `barcodeValue`.
 *  V1 used `linkToPassPage` (deprecated on V3).
 */
function makeV3SuccessBody(overrides: Partial<{
  identifier: string;
  downloadPage: string;
  iPhoneUri: string;
  androidUri: string;
  barcodeValue: string | null;
}> = {}) {
  return {
    success: true,
    description: 'Pass has been created.',
    errors: [],
    data: {
      identifier: overrides.identifier ?? 'a0f629e6-6533-40cb-90b8-ef9093bfbb26',
      templateId: 'pc-tpl-123',
      downloadPage:
        overrides.downloadPage ?? 'https://app.passcreator.com/p/a8976234876af9sdhk',
      iPhoneUri:
        overrides.iPhoneUri ?? 'https://app.passcreator.com/linkToPassFile.pkpass',
      androidUri:
        overrides.androidUri ?? 'https://pay.google.com/save/linkToGoogleWalletPassUri',
      barcodeValue:
        'barcodeValue' in overrides
          ? overrides.barcodeValue
          : '3897897988979823497234',
      bundleId: null,
      genericProperties: {},
    },
    statusCode: 200,
    count: 1,
  };
}

describe('issuePass — Passcreator V3 per-pass runtime endpoint', () => {
  it('happy path: V3 success envelope → returns identifier + downloadPage + iPhoneUri + androidUri + barcodeValue', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 201, body: makeV3SuccessBody() }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    // Real V3 fields returned by the wrapper
    expect(result.identifier).toBe('a0f629e6-6533-40cb-90b8-ef9093bfbb26');
    expect(result.downloadPage).toBe('https://app.passcreator.com/p/a8976234876af9sdhk');
    expect(result.iPhoneUri).toBe('https://app.passcreator.com/linkToPassFile.pkpass');
    expect(result.androidUri).toBe('https://pay.google.com/save/linkToGoogleWalletPassUri');
    expect(result.barcodeValue).toBe('3897897988979823497234');

    // URL + method + body shape pinned
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // MUST include ?async=false — without it, Passcreator returns
    // 200 with success:true but barcodeValue is empty (docs §
    // "If you need to see the actual barcodeValue in the JSON
    // response body, you need to set async to false").
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://app.passcreator.com/api/v3/pass?async=false',
    );
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    // Body MUST wrap fields in a `data` object (V3 contract — docs
    // § "The following properties of the `data` object can/must be
    // submitted in the request body").
    expect(body).toHaveProperty('data');
    expect(body.data.templateId).toBe('pc-tpl-123');
    // Additional properties go DIRECTLY inside `data` (NOT under an
    // `additionalPropertyValues` wrapper — that field name does not
    // exist on V3 create).
    expect(body.data).not.toHaveProperty('additionalPropertyValues');
    // v3-fix-2026-10-19: SAOME template mapping emits `memberName`
    // as primaryFields[0].key (see passTemplateMapping.ts v12-followup).
    // Passcreator resolves `{memberName}` against this exact body
    // field name — sending `data.name` previously left the rendered
    // pass blank. The renamed field is the regression target for
    // `v3-fix: request body sends data.memberName (NOT data.name)`
    // below.
    expect(body.data.memberName).toBe('王小明');
    expect(body.data).not.toHaveProperty('name');
    expect(body.data.phone).toBe('+886912345678');
    expect(body.data.birthday).toBe('1990-01-15');
    expect(body.data.email).toBe('wang@example.com');
  });

  it('network failure (fetch throws) → BadGatewayError kind="network"', async () => {
    // Simulate Cloudflare Workers' `fetch` rejecting (DNS, TLS, abort,
    // connection refused). The wrapper must wrap the underlying
    // TypeError / Error into BadGatewayError with kind='network' so
    // the route layer surfaces a "check your network" banner.
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'));
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('network');
      expect(bge.details?.upstream).toBe('passcreator');
      expect(bge.details?.upstreamStatus).toBeUndefined();
      expect(String(bge.details?.upstreamBody ?? '')).toContain('ECONNREFUSED');
    }
  });

  it('V3 error envelope → BadGatewayError kind="upstream_rejected" with upstreamErrors', async () => {
    // Mirrors the V2 envelope shape — Passcreator V3 uses the same
    // `{success, description, errors, data, statusCode}` envelope
    // (verified against the V3 list endpoint 2026-10-19). Per-field
    // paths in `errors[].property` use the OUTER `data` wrapper —
    // e.g. `errors[].property === 'data.email'` (NOT
    // `additionalPropertyValues.email`).
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          description: 'Invalid data.',
          errors: [{ property: 'data.email', message: 'is invalid' }],
          data: [],
          statusCode: 400,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('upstream_rejected');
      expect(bge.details?.upstreamStatus).toBe(400);
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'data.email', message: 'is invalid' },
      ]);
    }
  });

  it('V3 singular-object errors shape → normalized to 1-entry upstreamErrors', async () => {
    // Some Passcreator endpoints (verified against V2) use a
    // singular-object `errors` field rather than an array. The
    // shared `normalizePasscreatorErrorEntries` helper handles both
    // shapes — V3 inherits the same path through `passcreatorFetch`.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 422,
        body: {
          success: false,
          description: 'Template not found.',
          errors: { property: 'data.templateId', message: 'unknown templateId' },
          data: [],
          statusCode: 422,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-bogus', makeHolder());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('upstream_rejected');
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'data.templateId', message: 'unknown templateId' },
      ]);
    }
  });

  it('V3 response missing both data.identifier and top-level id → BadGatewayError with hint', async () => {
    // Defensive: even if the upstream returns 201 with junk body,
    // we surface a clear error pointing at the V3 envelope contract.
    // Note: V3 docs put the per-pass fields at `data.{identifier,
    // downloadPage, iPhoneUri, androidUri, barcodeValue}` — not at
    // `data.linkToPassPage` (that's the V1 field name).
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 201,
        body: {
          success: true,
          description: 'Pass has been created.',
          errors: [],
          data: [],     // ← empty array, not the documented object
          statusCode: 201,
        },
      }),
    );
    try {
      await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      // No upstreamStatus (the upstream was 2xx — we don't propagate that)
      expect(bge.details?.upstreamStatus).toBeUndefined();
      // Hint message points at the expected V3 envelope location
      // (`data.identifier + data.downloadPage` per docs § Returned
      // values). V1's `linkToPassPage` is no longer present.
      expect(String(bge.details?.upstreamBody ?? '')).toContain('identifier+downloadPage');
      expect(String(bge.details?.upstreamBody ?? '')).not.toContain('linkToPassPage');
    }
  });

  it('non-ASCII holder name round-trips correctly through JSON serialization (regression — workerd JSON.stringify pitfall)', async () => {
    // Rule 027 § workerd `JSON.stringify` pitfall: workerd's runtime
    // breaks non-ASCII strings into `\uFFFD` (replacement character)
    // when `JSON.stringify` is called manually. The wrapper here
    // uses `JSON.stringify(init.body)` via the shared `passcreatorFetch`
    // helper — but the body value comes from the SAOME backend's
    // own JS object, NOT from a postgres-side `JSON.stringify`.
    // This test pins the contract: a holder name with Chinese /
    // emoji characters MUST survive the round-trip from JS object →
    // fetch body → Passcreator envelope (where Passcreator's
    // response echoes the value back). If workerd corrupts the body,
    // Passcreator would return `errors: [{property:'data.name', ...}]`
    // and our wrapper would throw upstream_rejected — that path is
    // covered by the V3-error-envelope test above.
    //
    // The test asserts the OUTGOING fetch body contains the original
    // bytes (not replacement characters), which is the strongest
    // static guarantee the wrapper can provide.
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 201, body: makeV3SuccessBody() }));

    const trickyName = '哈囉 🎉 Café';   // zh-TW + emoji + accented Latin
    await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder({ name: trickyName }));

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const bodyStr = init.body as string;
    // Body MUST contain the original non-ASCII bytes verbatim — no
    // `\uFFFD` replacement characters.
    expect(bodyStr).toContain(trickyName);
    expect(bodyStr).not.toContain('\uFFFD');
    // Bonus: confirm the JSON parse preserves the bytes too — and
    // confirm the field is at `data.name` (NOT at `additionalPropertyValues.name`).
    const parsed = JSON.parse(bodyStr);
    // v3-fix-2026-10-19: must pin the post-rename field name.
    expect(parsed.data.memberName).toBe(trickyName);
    expect(parsed).not.toHaveProperty('additionalPropertyValues');
  });

  // =====================================================================
  // 2026-10-19 — v3-fix conformance: holder name MUST be sent at
  // `data.memberName` (NOT `data.name`) so the per-pass `{memberName}`
  // placeholder configured by
  // `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::primaryFields`
  // (v12-followup, 2026-10-12) can resolve. Sending `data.name` left
  // `memberName:` empty in Passcreator's dashboard — the rendered pass
  // had no holder name. The capture script
  // (`apps/backend/scripts/capture-passcreator-v3.cjs`) is the fixture
  // source-of-truth and MUST be aligned with this wire shape (Task 1.2).
  // =====================================================================
  it('v3-fix: request body sends data.memberName (NOT data.name)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 201, body: makeV3SuccessBody() }));

    await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder({ name: '王小明' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);

    // The new field MUST carry the holder name verbatim.
    expect(body.data.memberName).toBe('王小明');

    // The old field MUST be ABSENT — sending both would either be
    // silently dropped by Passcreator (best case) or cause an
    // upstream rejection on the per-pass "field name not declared
    // by template" rule (worst case). Either way: pin absence.
    expect(body.data).not.toHaveProperty('name');

    // Other 3 fields are unaffected by the rename.
    expect(body.data.phone).toBe('+886912345678');
    expect(body.data.birthday).toBe('1990-01-15');
    expect(body.data.email).toBe('wang@example.com');
  });

  it('v3-fix: capture fixture (v3-create-success.json) reflects the renamed memberName wire shape', async () => {
    // The capture script's `data` block is the live source-of-truth
    // fixture. This test fails if the fixture still uses the old
    // `name` key, catching the most likely drift vector
    // (someone edits the capture script but forgets to update
    // `passcreator.ts`, or vice versa).
    //
    // Skip if the fixture doesn't exist yet (first-time run before
    // `node apps/backend/scripts/capture-passcreator-v3.cjs`); a
    // missing fixture is NOT the same as a wrong-shape fixture.
    const fixturePath = nodePath.join(
      REPO_ROOT,
      'fixtures',
      'passcreator',
      'v3',
      'v3-create-success.json',
    );
    if (!fs.existsSync(fixturePath)) {
      // No fixture yet — nothing to pin. The first test above
      // already pins the wire shape via the production code path.
      return;
    }

    const fixtureContent = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const requestBody = fixtureContent?.request?.body;

    expect(requestBody).toBeDefined();
    expect(requestBody).toHaveProperty('data');
    // The renamed field MUST be present in the live fixture.
    expect(requestBody.data).toHaveProperty('memberName');
    expect(typeof requestBody.data.memberName).toBe('string');
    // The old field MUST be absent — drift vector guard.
    expect(requestBody.data).not.toHaveProperty('name');
    // Other 3 fields are stable across the rename.
    expect(requestBody.data).toHaveProperty('phone');
    expect(requestBody.data).toHaveProperty('birthday');
    expect(requestBody.data).toHaveProperty('email');
    expect(requestBody.data).toHaveProperty('templateId');
  });
});

// ============================================================================
// 2026-10-18 — P0 #3 barcodeValue defensive normalize
//
// Live V3 capture (2026-10-17, runs/improvements/feedback/20261018-passcreator-v3-capture.md)
// confirmed that Passcreator returns LITERAL placeholder strings in
// `data.barcodeValue` when a template has no barcode configured:
//
//   - "no value specified"  — observed in V3 CREATE response (Q2 root cause:
//                             production `pass_holders.barcode_value` was
//                             literally this string instead of NULL)
//   - "no value given"      — observed in V3 LIST response (no barcode per item)
//   - "no barcode"          — observed in Passcreator error messages
//   - ""                    — observed in some Passcreator responses
//
// Pre-fix, the parser passed the string through verbatim → DB stored the
// placeholder as if it were a real barcode. This describe block pins the
// defensive normalize: any of the 4 placeholders → null; real barcode
// values (numeric strings) → unchanged.
//
// After the parser change, the EXISTING V3 success fixture test
// (which pins `expect(result.barcodeValue).toBe('no value specified')`)
// will be updated to assert `null` instead — see Phase 2 of
// runs/improvements/feedback/20261018-passcreator-v3-parser-defensive-normalize.md.
// ============================================================================

describe('Passcreator client — barcodeValue defensive normalize (P0 #3 — 2026-10-17 capture)', () => {
  /**
   * Each test pins one branch of the placeholder set. Real barcode
   * values (numeric strings like '3897897988979823497234') must
   * pass through unchanged.
   *
   * The 6th test exercises the legacy flat-shape fallback of
   * `extractPassIssueData` (when the response puts identifier +
   * downloadPage at the top level rather than inside `data`).
   */

  it('"no value specified" → null (Q2 root case, live-captured)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: 'no value specified' }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
  });

  it('"no value given" → null (observed in V3 list response)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: 'no value given' }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
  });

  it('"no barcode" → null (defensive — seen in Passcreator error copy)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: 'no barcode' }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
  });

  it('"" (empty string) → null (Passcreator sometimes returns empty)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: '' }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
  });

  it('real barcode value (numeric string) → unchanged', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: '3897897988979823497234' }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBe('3897897988979823497234');
  });

  it('non-string barcodeValue (e.g. null in body) → null (defensive)', async () => {
    // Passcreator V3 docs § "Returned values" says barcodeValue
    // can be a string OR null. We accept null and return null.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3SuccessBody({ barcodeValue: null }) }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
  });

  it('legacy flat-shape response with placeholder barcodeValue → null (extractPassIssueData fallback branch)', async () => {
    // Exercises the SECOND branch of extractPassIssueData (legacy /
    // test-double flat shape: identifier + downloadPage at top level,
    // no `data` wrapper). The defensive normalize must apply to
    // BOTH branches — otherwise a future legacy mock with placeholder
    // barcodeValue would slip through the parser unchanged.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          identifier: 'legacy-flat-1',
          downloadPage: 'https://app.passcreator.com/p/legacy',
          iPhoneUri: 'https://app.passcreator.com/legacy.pkpass',
          androidUri: 'https://pay.google.com/save/legacy',
          barcodeValue: 'no value specified',
        },
      }),
    );
    const result = await issuePass(VALID_ENV, 'pc-tpl-123', makeHolder());
    expect(result.barcodeValue).toBeNull();
    // Sanity: identifier + URLs still parse correctly from the flat shape
    expect(result.identifier).toBe('legacy-flat-1');
    expect(result.downloadPage).toBe('https://app.passcreator.com/p/legacy');
  });
});

// ============================================================================
// 2026-10-18 — V3 per-pass GET/LIST helpers for barcode backfill
//
// Production bug (2026-10-18): V3 CREATE returns `barcodeValue:
// "no value specified"` (a literal sentinel) for templates with
// `useAutoIdForValue=true` — even when the template HAS an auto-
// generated ID configured. The real per-pass barcode rendered on
// the wallet pass lives at `generatedId` (single-pass GET) or
// `autoGeneratedId` (LIST filter). SAOME's create response parsing
// collapses both sentinels AND null to `barcodeValue = null`, so
// the DB ends up storing `barcode_value = NULL` — even though
// Passcreator's dashboard shows the live barcode (e.g.
// "zbood1tvxrvl31kv9e6ad3ef2f71561" for the ILJOI holder).
//
// Fix: after a successful `issuePass` returns `barcodeValue: null`
// (or a sentinel), the registerService calls one of these two
// helpers to backfill the real value:
//
//   - `getPassByIdentifier` — PRIMARY path. Returns a single
//     per-pass runtime object. Real auto-gen barcode lives at
//     `data.generatedId` (singular — only this endpoint uses the
//     singular form).
//
//   - `listPasses` — FALLBACK path. Returns the list envelope
//     (paginated). Real auto-gen barcode lives at
//     `data[].autoGeneratedId` (plural). Used when single-pass
//     GET is unavailable (network race, Passcreator changes
//     contract, etc.).
//
// Both helpers MUST populate `barcodeValue` via the unified
// `extractBackfillBarcodeValue` helper, which collapses any of the
// 4 placeholder strings to `null` AND falls back to `generatedId` /
// `autoGeneratedId` when `barcodeValue` is a placeholder — so the
// registerService layer can persist a real string OR null without
// needing to know about Passcreator's two-tiered data layout.
//
// Reference (live capture 2026-10-18):
//   - fixtures/passcreator/v3/v3-get-single.json (REST path)
//   - fixtures/passcreator/v3/v3-list-filtered.json (LIST filter)
//   - fixtures/passcreator/v3/probe/SUMMARY.md (4 candidate URLs
//     probed against the ILJOI holder identifier)
// ============================================================================

const BACKFILL_IDENTIFIER = '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee';
const BACKFILL_BARCODE = 'zbood1tvxrvl31kv9e6ad3ef2f71561';

/**
 * Single-pass GET success envelope — mirrors the real V3 response
 * shape captured 2026-10-18 against the ILJOI holder. Note:
 * - `data.generatedId` is SINGULAR (only the single-pass GET uses
 *   this name — LIST uses `autoGeneratedId` PLURAL).
 * - `data.barcodeValue` is ABSENT (not a placeholder — Passcreator
 *   simply omits the field when useAutoIdForValue=true).
 * - `data.linkToPassPage` is present (the universal landing page).
 */
function makeV3GetSingleBody(overrides: {
  identifier?: string;
  generatedId?: string | null;
  linkToPassPage?: string;
} = {}) {
  return {
    statusCode: 200,
    success: true,
    description: 'Success',
    errors: [],
    count: 1,
    responseMetaData: null,
    data: {
      identifier: overrides.identifier ?? BACKFILL_IDENTIFIER,
      templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
      generatedId: overrides.generatedId ?? BACKFILL_BARCODE,
      linkToPassPage:
        overrides.linkToPassPage ?? 'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
      qrCodeImage: 'https://app.passcreator.com/qr/no%20value%20given',
      name: 'not good',
      type: 'storeCard',
      // CRITICAL: barcodeValue is intentionally ABSENT here. The
      // production behavior is "field omitted entirely" — not a
      // placeholder string. The backfill helper MUST tolerate both
      // shapes (absent + placeholder).
    },
  };
}

/**
 * LIST filter success envelope — mirrors the real V3 response shape
 * captured 2026-10-18 against the ILJOI holder. Note:
 * - `data[]` is an ARRAY (paginated).
 * - Each item has `autoGeneratedId` PLURAL (not `generatedId`).
 * - `barcodeValue: "no value given"` is the LITERAL placeholder
 *   string (per `BARCODE_VALUE_PLACEHOLDERS`).
 */
function makeV3ListFilteredBody(overrides: {
  identifier?: string;
  autoGeneratedId?: string;
  barcodeValue?: string | null;
} = {}) {
  return {
    statusCode: 200,
    success: true,
    description: 'Success',
    errors: [],
    count: 100,
    responseMetaData: { resultsTotal: 225, resultsThisPage: 100 },
    page: {
      next: 'https://app.passcreator.com/api/v3/pass/?pageSize=100&startUid=abc&startCreatedOnTimestamp=1772563198000',
    },
    data: [
      {
        identifier: overrides.identifier ?? BACKFILL_IDENTIFIER,
        autoGeneratedId: overrides.autoGeneratedId ?? BACKFILL_BARCODE,
        voided: false,
        notYetValid: false,
        templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
        templateName: 'not good',
        linkToPassPage: 'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
        barcodeValue: overrides.barcodeValue ?? 'no value given',
        bundleId: null,
      },
      // Second item (different identifier) — confirms the helper
      // filters by `identifier` AND that other items are ignored.
      {
        identifier: '755fd7d7-ed6b-4150-859c-ac642b483b17',
        autoGeneratedId: 's7m9ho6nlc6ft0356v6ad3e4611c0db',
        barcodeValue: 'no value given',
      },
    ],
  };
}

describe('getPassByIdentifier — V3 single-pass GET (regression — 2026-10-18 barcode backfill)', () => {
  it('happy path: 200 + generatedId → returns identifier + barcodeValue + 3 URIs', async () => {
    // Mirrors the live V3 capture against the ILJOI holder
    // (`v3-get-single.json` fixture). The `data.barcodeValue` field
    // is ABSENT (Passcreator omits the field entirely for
    // useAutoIdForValue=true templates) — the backfill helper
    // MUST fall back to `data.generatedId` and return that as the
    // barcodeValue. This is the P0 #4 root-cause fix: production
    // was persisting `barcode_value = NULL` when the real value
    // was sitting right there in `generatedId`.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3GetSingleBody() }),
    );
    const result = await getPassByIdentifier(VALID_ENV, BACKFILL_IDENTIFIER);
    // All 4 fields populated
    expect(result.identifier).toBe(BACKFILL_IDENTIFIER);
    // barcodeValue falls back to generatedId when the field is
    // absent (or contains a placeholder string).
    expect(result.barcodeValue).toBe(BACKFILL_BARCODE);
    // The 3 URIs are extracted from the V3 single-pass GET
    // envelope shape (`data.linkToPassPage` for downloadPage,
    // no `iPhoneUri` / `androidUri` in this minimal envelope —
    // they would be absent in the real capture too).
    expect(result.downloadPage).toBe(
      'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
    );

    // URL + method pinned
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `https://app.passcreator.com/api/v3/pass/${BACKFILL_IDENTIFIER}`,
    );
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('GET');
  });

  it('network failure → BadGatewayError kind="network" (mirrors issuePass behavior)', async () => {
    // The helper reuses `passcreatorFetch`, so the 3-layer error
    // envelope is identical to V2 surface — including network /
    // invalid_response / upstream_rejected categorization. This
    // test pins the network path so a future refactor that swaps
    // `passcreatorFetch` for raw `fetch` is caught loudly.
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'));
    try {
      await getPassByIdentifier(VALID_ENV, BACKFILL_IDENTIFIER);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('network');
      expect(bge.details?.upstream).toBe('passcreator');
    }
  });

  it('identifier absent from envelope → throws BadGatewayError (regression — fixture-shape guard)', async () => {
    // Defensive: if Passcreator's single-pass GET envelope shape
    // ever drifts (e.g. they move `identifier` under a different
    // key), the helper MUST throw rather than silently return a
    // bogus barcodeValue. This pins the contract.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          statusCode: 200,
          success: true,
          description: 'Success',
          errors: [],
          count: 1,
          responseMetaData: null,
          data: {
            // identifier intentionally absent — simulates envelope drift
            generatedId: BACKFILL_BARCODE,
            linkToPassPage: 'https://app.passcreator.com/p/x',
          },
        },
      }),
    );
    try {
      await getPassByIdentifier(VALID_ENV, BACKFILL_IDENTIFIER);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(String(bge.details?.upstreamBody ?? '')).toMatch(
        /missing identifier/,
      );
    }
  });
});

describe('listPasses — V3 LIST filter fallback (regression — 2026-10-18 barcode backfill)', () => {
  it('happy path: 200 + autoGeneratedId → returns filtered array with the matching identifier', async () => {
    // Mirrors the live V3 capture (`v3-list-filtered.json`). The
    // list response includes BOTH `barcodeValue` (placeholder) AND
    // `autoGeneratedId` (real). The helper MUST extract from
    // `autoGeneratedId` when `barcodeValue` is a placeholder.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: makeV3ListFilteredBody() }),
    );
    const result = await listPasses(VALID_ENV, {
      templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
      identifier: BACKFILL_IDENTIFIER,
    });
    // The filter MUST isolate the matching identifier (not return
    // every pass in the template — there are 100+ in the real
    // capture, and the helper filters down to the one row we need).
    expect(result).toHaveLength(1);
    expect(result[0]?.identifier).toBe(BACKFILL_IDENTIFIER);
    expect(result[0]?.barcodeValue).toBe(BACKFILL_BARCODE);
    // downloadPage falls back to linkToPassPage (the list endpoint
    // uses the V1 field name, not V3-create's `downloadPage`).
    expect(result[0]?.downloadPage).toBe(
      'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
    );

    // URL + query params pinned
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain('/api/v3/pass');
    expect(url).toContain(`identifier=${BACKFILL_IDENTIFIER}`);
    expect(url).toContain('templateId=22d0d89d-9a5e-4b7d-9aae-3259312f8849');
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('GET');
  });

  it('identifier absent from filtered list → returns empty array (NOT a throw)', async () => {
    // Defensive: if the identifier isn't in the list (e.g. the
    // template has 100+ items but the cursor pagination would
    // require more pages), the helper returns an empty array —
    // the caller can fall back to "barcode_value stays null"
    // rather than treating it as a hard failure. This avoids
    // breaking the registration flow when Passcreator paginates
    // the list away from the target identifier.
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          statusCode: 200,
          success: true,
          errors: [],
          data: [
            {
              identifier: 'some-other-pass',
              autoGeneratedId: 'aaaaa',
              barcodeValue: 'no value given',
            },
          ],
        },
      }),
    );
    const result = await listPasses(VALID_ENV, {
      templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
      identifier: BACKFILL_IDENTIFIER,
    });
    expect(result).toEqual([]);
  });

  it('barcodeValue placeholder + autoGeneratedId absent → barcodeValue stays null (no barcode configured)', async () => {
    // Real scenario: a template WITHOUT `useAutoIdForValue=true`
    // AND without a barcode config. Both `barcodeValue` AND
    // `autoGeneratedId` are absent / placeholders. The helper
    // MUST return `null` (NOT throw, NOT return the placeholder)
    // so the caller persists NULL → DB row correctly records
    // "no barcode configured for this holder".
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          statusCode: 200,
          success: true,
          errors: [],
          data: [
            {
              identifier: BACKFILL_IDENTIFIER,
              // barcodeValue is the placeholder — same shape as
              // production captured in the 2026-10-18 LIST response
              barcodeValue: 'no value given',
              // autoGeneratedId intentionally absent
              linkToPassPage: 'https://app.passcreator.com/p/x',
            },
          ],
        },
      }),
    );
    const result = await listPasses(VALID_ENV, {
      templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
      identifier: BACKFILL_IDENTIFIER,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.barcodeValue).toBeNull();
  });
});

// ============================================================================
// 2026-10-18 — Live V3 GET/LIST backfill fixtures (regression — production
// barcode_value drift)
//
// The two fixtures below are produced by `capture-passcreator-v3.cjs`
// (and `probe-passcreator-v3-get.cjs`). They pin the LIVE V3 single-pass
// GET and LIST filter response shapes so the backfill helpers'
// envelope-parsing logic is verified against real production bytes —
// not just our hand-rolled mocks.
//
// Fixture inventory:
//   - v3/v3-get-single.json — GET /api/v3/pass/{identifier} → 200 with
//     `data.{identifier, generatedId, linkToPassPage}`. Note: NO
//     `barcodeValue` field. The `generatedId` IS the real barcode for
//     useAutoIdForValue=true templates.
//   - v3/v3-list-filtered.json — GET /api/v3/pass?identifier={id} → 200
//     with paginated `data[]`. Each item has `barcodeValue: "no value
//     given"` (placeholder) + `autoGeneratedId: <real>`.
//
// These tests are SKIPPED when the fixture file is missing (e.g., the
// capture script has not been run yet) — same convention as the V3
// SUCCESS / LIST / ERROR fixture tests above.
// ============================================================================

describe('Passcreator client — live V3 GET-single fixture (regression — 2026-10-18 backfill)', () => {
  const fixture = fixtureOrSkip('v3/v3-get-single');

  describe('scenario: v3-get-single (GET /api/v3/pass/{id} → 200 with generatedId)', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 200 status and the V3 single-pass envelope (data.{identifier, generatedId, linkToPassPage})', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(200);
      const body = fixture!.response.body as {
        success?: unknown;
        data?: Record<string, unknown>;
      };
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('identifier');
      // CRITICAL: `generatedId` is SINGULAR here (only this
      // endpoint uses this name — LIST uses `autoGeneratedId`).
      expect(body.data).toHaveProperty('generatedId');
      expect(typeof body.data.generatedId).toBe('string');
      expect((body.data.generatedId as string).length).toBeGreaterThan(0);
      // linkToPassPage is the universal landing page URL on
      // single-pass GET (LIST also returns it; V3-create uses
      // `downloadPage` instead).
      expect(body.data).toHaveProperty('linkToPassPage');
      // barcodeValue is ABSENT (not a placeholder — the field is
      // simply missing from this endpoint's envelope).
      expect(body.data).not.toHaveProperty('barcodeValue');
    });

    itFixture('client correctly extracts generatedId as barcodeValue when mock returns the fixture body', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      const result = await getPassByIdentifier(VALID_ENV, BACKFILL_IDENTIFIER);
      // The fixture's `data.generatedId` field carries the real
      // auto-generated barcode for the ILJOI holder. The helper
      // MUST surface this as `result.barcodeValue` — that's the
      // whole point of the backfill.
      expect(result.identifier).toBe(BACKFILL_IDENTIFIER);
      expect(result.barcodeValue).toBe(BACKFILL_BARCODE);
    });
  });
});

describe('Passcreator client — live V3 LIST-filtered fixture (regression — 2026-10-18 backfill)', () => {
  const fixture = fixtureOrSkip('v3/v3-list-filtered');

  describe('scenario: v3-list-filtered (GET /api/v3/pass?identifier={id} → 200 with autoGeneratedId)', () => {
    const itFixture = fixture ? it : it.skip;

    itFixture('fixture exists with a 200 status, paginated data[], and the V3 LIST envelope', () => {
      expect(fixture).not.toBeNull();
      expect(fixture!.response.status).toBe(200);
      const body = fixture!.response.body as {
        success?: unknown;
        data?: unknown[];
      };
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      // The target identifier MUST be in the data[] — that's the
      // whole point of the LIST filter fallback.
      const matching = (body.data as Array<Record<string, unknown>>).find(
        (item) => item.identifier === BACKFILL_IDENTIFIER,
      );
      expect(matching).toBeDefined();
      // The matching item has both `barcodeValue` (placeholder)
      // AND `autoGeneratedId` (real). The helper MUST extract
      // from `autoGeneratedId`.
      expect(matching?.barcodeValue).toBe('no value given');
      expect(matching?.autoGeneratedId).toBe(BACKFILL_BARCODE);
    });

    itFixture('listPasses filters down to the matching identifier and surfaces autoGeneratedId as barcodeValue', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
      );
      const result = await listPasses(VALID_ENV, {
        templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
        identifier: BACKFILL_IDENTIFIER,
      });
      // The helper filters out the second item (different
      // identifier) and returns ONLY the matching one.
      expect(result).toHaveLength(1);
      expect(result[0]?.identifier).toBe(BACKFILL_IDENTIFIER);
      expect(result[0]?.barcodeValue).toBe(BACKFILL_BARCODE);
    });
  });
});
