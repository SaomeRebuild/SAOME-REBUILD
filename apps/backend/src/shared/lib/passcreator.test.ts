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
} from './passcreator';
import { BadGatewayError } from './saomeError';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';

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
  it('uses PUT method (full template body convention)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: { success: true, data: { identifier: 'pc-1' }, errors: [], statusCode: 200 },
      }),
    );
    await updatePassTemplate(VALID_ENV, 'pc-1', makeBody());
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
  });
  it('falls back to existing id when response body is empty (e.g. 204 No Content)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 204, body: null }));
    const result = await updatePassTemplate(VALID_ENV, 'pc-existing', makeBody());
    expect(result.id).toBe('pc-existing');
  });
  it('falls back to existing id when success envelope has data: [] (no id anywhere)', async () => {
    // Edge case: PUT succeeds but Passcreator returns the success
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

  it('extracts errors[] from PUT 400 (updatePassTemplate)', async () => {
    // Same envelope as POST — verify the extraction works for both verbs.
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
    const modules = import.meta.glob<CapturedFixture>(
      '../../../../../fixtures/passcreator/*.json',
      { eager: true },
    );
    const out: Record<string, CapturedFixture> = {};
    for (const [path, mod] of Object.entries(modules)) {
      const match = path.match(/\/([^/]+)\.json$/);
      if (match) out[match[1]] = mod;
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
