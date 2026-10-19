/**
 * Unit tests for shared/lib/passcreator/errors (error envelope helpers).
 *
 * @module shared/lib/passcreator/errors.test
 *
 * Conformance tests pin the error-envelope extraction contract:
 *   - V2 `errors[]` array + singular-object shapes → upstreamErrors[]
 *   - V3 `errors: string[]` → wrapped into upstreamErrors
 *   - Empty / malformed entries → filtered defensively
 *   - Error kind categorization (network / invalid_response / upstream_rejected)
 *   - Upstream body truncation to 500 chars + suffix
 *   - Live V2 captured fixtures (4 scenarios: empty-body, invalid-pass-type-id,
 *     bad-token, wrong-format-field)
 *
 * Live fixture tests register as `it.skip` when the fixture file is absent
 * (capture script not yet run) — capture is opt-in, not a CI gate.
 * Run `node apps/backend/scripts/capture-passcreator-errors.cjs` to generate.
 *
 * Rule references:
 *   - Rule 000 Part C.3 — upstream errors must be converted to SaomeError
 *     at the boundary.
 *   - Rule 019 § D.3 — third-party API contract is pinned by live fixture tests.
 */

import { describe, it, expect } from 'vitest';
import {
  createPassTemplate,
  updatePassTemplate,
  issuePass,
} from '../passcreator';
import { BadGatewayError } from '../saomeError';
import {
  VALID_ENV,
  fetchSpy,
  makeBody,
  makeResponse,
  makeHolder,
  fixtureOrSkip,
  isV2ErrorEnvelope,
  extractUpstreamErrorsLikeClient,
} from './__fixtures__';

describe('Passcreator client — V2 errors[] extraction (regression — 2026-10-11)', () => {
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
      expect(String(bge.details?.upstreamBody ?? '')).toContain(
        '"description":"The provided JSON was invalid."',
      );
    }
  });

  it('extracts errors[] from a SINGLE-OBJECT envelope (Passcreator uses both array and object forms)', async () => {
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
      expect(bge.details?.upstreamErrors).toBeUndefined();
    }
  });

  it('filters out malformed error entries (non-{property, message} objects)', async () => {
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
  it('sets kind="network" when fetch throws (DNS / connection refused)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));
    try {
      await createPassTemplate(VALID_ENV, makeBody());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      const bge = err as BadGatewayError;
      expect(bge.details?.kind).toBe('network');
      expect(bge.details?.upstreamStatus).toBeUndefined();
    }
  });

  it('sets kind="invalid_response" for non-2xx with non-JSON body (Cloudflare 530 / 1016 regression)', async () => {
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
      expect(String(bge.details?.upstreamBody ?? '')).toContain('error code: 1016');
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
      expect(bge.details?.upstreamErrors).toEqual([
        { property: 'description', message: 'is required' },
      ]);
    }
  });
});

describe('Passcreator client — error envelope contract', () => {
  it('truncates a long upstream body to ≤ 500 chars + suffix', async () => {
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

// ============================================================================
// Live V2 captured fixtures
//
// The 4 fixtures below are produced by
//   `node apps/backend/scripts/capture-passcreator-errors.cjs`
// which runs hand-crafted failing requests against the real Passcreator V2 API
// and saves the responses. They pin the V2 envelope shape so future
// Passcreator API changes are caught by the tests.
//
// Tests register as `it.skip` when the fixture file is absent — capture
// is opt-in, not a CI gate.
// ============================================================================

describe('Passcreator client — live V2 error fixtures (regression — 2026-10-11 capture)', () => {
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
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(typeof entry.property).toBe('string');
        expect(typeof entry.message).toBe('string');
        expect(entry.message.length).toBeGreaterThan(0);
      }
    });

    itFixture('client correctly extracts errors[] when mock returns the fixture body', async () => {
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
        const upstreamErrors = bge.details?.upstreamErrors as Array<{
          property: string;
          message: string;
        }> | undefined;
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
      expect(isV2ErrorEnvelope(fixture!.response.body)).toBe(true);
    });

    itFixture(
      'client extracts the singular errors object as a 1-entry upstreamErrors (regression — v6 fixture)',
      async () => {
        if (
          Array.isArray((fixture!.response.body as { errors: unknown }).errors)
        ) {
          const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
          expect(entries.some((e) => e.property === 'passTypeId')).toBe(true);
        } else {
          const entries = extractUpstreamErrorsLikeClient(fixture!.response.body);
          expect(entries).toEqual([
            { property: 'passTypeId', message: 'This pass type ID is not known.' },
          ]);
        }
      },
    );

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
        const upstreamErrors = bge.details?.upstreamErrors as Array<{
          property: string;
          message: string;
        }> | undefined;
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
      expect([401, 403]).toContain(fixture!.response.status);
    });

    itFixture(
      'client assigns kind="upstream_rejected" if V2 envelope, otherwise "invalid_response"',
      async () => {
        fetchSpy.mockResolvedValueOnce(
          makeResponse({ status: fixture!.response.status, body: fixture!.response.body }),
        );
        try {
          await createPassTemplate(VALID_ENV, makeBody());
          expect.fail('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(BadGatewayError);
          const bge = err as BadGatewayError;
          expect(['upstream_rejected', 'invalid_response']).toContain(bge.details?.kind);
          const bodyText = JSON.stringify(fixture!.response.body);
          expect(bodyText).not.toContain('wrong-key-capture-test');
        }
      },
    );
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
      const mentions = names.some(
        (n) => /^colors(\.|$)/i.test(n) || n === 'colors',
      );
      expect(mentions).toBe(true);
    });
  });
});

// ============================================================================
// 2026-10-17 — P0 #2 V3 error envelope string-array wrap
//
// Live V3 capture (2026-10-17) showed Passcreator's V3 error envelope
// uses `errors: string[]` — distinct from V2's `{property, message}[]`.
// The helper `normalizePasscreatorErrorEntries` now handles this via
// `extractUpstreamErrors` in `errors.ts`.
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
      expect((err as BadGatewayError).details?.upstreamErrors).toEqual([
        { property: 'data', message: 'Template not found!' },
      ]);
    }
  });

  it('V2 array-of-objects shape STILL uses property from each entry (regression guard)', async () => {
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
      expect((err as BadGatewayError).details?.upstreamErrors).toEqual([
        { property: 'data.email', message: 'is invalid' },
        { property: 'data.phone', message: 'format wrong' },
      ]);
    }
  });
});
