/**
 * Unit tests for shared/lib/passcreator/v2-template (V2 template lifecycle).
 *
 * @module shared/lib/passcreator/v2-template.test
 *
 * Conformance tests pin the V2 template publish contract:
 *   - `createPassTemplate` → returns `data.identifier` from V2 success envelope
 *   - `updatePassTemplate` → returns existing id when no envelope returned
 *   - `fetchPassTemplate` → returns parsed JSON on 2xx
 *   - Live V2 SUCCESS captured fixture (2026-10-12) pins the real envelope
 *     bytes so future Passcreator API changes are caught.
 *
 * Live fixture tests register as `it.skip` when the fixture file is absent.
 *
 * Rule references:
 *   - Rule 000 Part C.3 — third-party service must convert upstream
 *     errors to SaomeError at the boundary.
 *   - Rule 019 § D.3 — third-party API contract is pinned by live fixture tests.
 */

import { describe, it, expect } from 'vitest';
import {
  createPassTemplate,
  updatePassTemplate,
  fetchPassTemplate,
} from '../passcreator';
import { BadGatewayError } from '../saomeError';
import {
  VALID_ENV,
  fetchSpy,
  makeBody,
  makeResponse,
  fixtureOrSkip,
} from './__fixtures__';

describe('Passcreator client — createPassTemplate', () => {
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
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://app.passcreator.com/api/v2/pass-template',
    );
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const headers = (fetchSpy.mock.calls[0]?.[1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers.Authorization).toBe('test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('falls back to top-level id when data.identifier is missing (legacy / test-double)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 201, body: { id: 'pc-legacy' } }),
    );
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
    await createPassTemplate(
      { ...VALID_ENV, PASSCREATOR_API_URL: 'https://app.passcreator.com/' },
      makeBody(),
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://app.passcreator.com/api/v2/pass-template',
    );
  });

  it('live V2 envelope shape (regression — 2026-10-12 production push)', async () => {
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
          data: [], // ← empty array, not an object with identifier
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
      expect(String(bge.details?.upstreamBody ?? '')).toContain(
        'create response missing id',
      );
    }
  });

  it('throws BadGatewayError when body is non-JSON', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: '<html>oops</html>' }),
    );
    await expect(
      createPassTemplate(VALID_ENV, makeBody()),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });

  it('throws BadGatewayError on non-2xx with status propagated to details', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 502, body: { error: 'bad' } }),
    );
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
    await expect(
      createPassTemplate(VALID_ENV, makeBody()),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });

  it('throws BadGatewayError on AbortSignal timeout', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('The operation was aborted'));
    await expect(
      createPassTemplate(VALID_ENV, makeBody()),
    ).rejects.toBeInstanceOf(BadGatewayError);
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
    const result = await updatePassTemplate(
      VALID_ENV,
      '85b855a5-ec86-4fd6-a48e-892ed143ae0f',
      makeBody(),
    );
    expect(result.id).toBe('85b855a5-ec86-4fd6-a48e-892ed143ae0f');
  });

  it('returns existing id when id matches the requested one (fall-through when no envelope returned)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: { id: 'pc-existing' } }),
    );
    const result = await updatePassTemplate(
      VALID_ENV,
      'pc-existing',
      makeBody(),
    );
    expect(result.id).toBe('pc-existing');
  });

  it('encodes the id in the URL (URL-safe)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          data: { identifier: 'pc-with spaces' },
          errors: [],
          statusCode: 200,
        },
      }),
    );
    await updatePassTemplate(VALID_ENV, 'pc-with spaces', makeBody());
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/\/api\/v2\/pass-template\/pc-with(%20|\+)spaces$/);
  });

  it('uses POST method (V2 endpoint convention — regression 2026-10-12)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 200,
        body: {
          success: true,
          data: { identifier: 'pc-1' },
          errors: [],
          statusCode: 200,
        },
      }),
    );
    await updatePassTemplate(VALID_ENV, 'pc-1', makeBody());
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toBe(
      'https://app.passcreator.com/api/v2/pass-template/pc-1',
    );
  });

  it('falls back to existing id when response body is empty (e.g. 204 No Content)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 204, body: null }));
    const result = await updatePassTemplate(
      VALID_ENV,
      'pc-existing',
      makeBody(),
    );
    expect(result.id).toBe('pc-existing');
  });

  it('falls back to existing id when success envelope has data: [] (no id anywhere)', async () => {
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
    const result = await updatePassTemplate(
      VALID_ENV,
      'pc-existing',
      makeBody(),
    );
    expect(result.id).toBe('pc-existing');
  });

  it('throws BadGatewayError on 5xx upstream', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 503, body: 'unavailable' }),
    );
    await expect(
      updatePassTemplate(VALID_ENV, 'pc-1', makeBody()),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });
});

describe('Passcreator client — fetchPassTemplate', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: { id: 'pc-1', name: 'X' } }),
    );
    const result = await fetchPassTemplate(VALID_ENV, 'pc-1');
    expect(result).toEqual({ id: 'pc-1', name: 'X' });
  });

  it('throws BadGatewayError on upstream 404 (we map all upstream errors to 502)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 404, body: 'not found' }),
    );
    try {
      await fetchPassTemplate(VALID_ENV, 'pc-missing');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadGatewayError);
      expect((err as BadGatewayError).details?.upstreamStatus).toBe(404);
    }
  });

  it('uses GET method', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: { id: 'pc-1' } }),
    );
    await fetchPassTemplate(VALID_ENV, 'pc-1');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });
});

// ============================================================================
// Live V2 SUCCESS captured fixture
//
// Captured 2026-10-12 against the real endpoint. Two production
// pushes returned this shape; the parser was reading top-level `id`
// (undefined) and surfaced "create response missing id". Pinning this
// fixture prevents future envelope-shape drift from silently breaking
// the publish flow.
// ============================================================================

describe('Passcreator client — live V2 SUCCESS fixture (regression — 2026-10-12 id-parse bug)', () => {
  const fixture = fixtureOrSkip('success-create');

  describe(
    'scenario: success-create (POST with full template body → 201 with data.identifier)',
    () => {
      const itFixture = fixture ? it : it.skip;

      itFixture(
        'fixture exists with a 201 status and the V2 success envelope',
        () => {
          expect(fixture).not.toBeNull();
          expect(fixture!.response.status).toBe(201);
          const body = fixture!.response.body as {
            success?: unknown;
            data?: unknown;
          };
          expect(body.success).toBe(true);
          expect(typeof body.data).toBe('object');
          expect((body.data as { identifier?: unknown })?.identifier).toBe(
            '85b855a5-ec86-4fd6-a48e-892ed143ae0f',
          );
        },
      );

      itFixture(
        'client extracts data.identifier and returns { id } (regression — 2026-10-12 production push)',
        async () => {
          fetchSpy.mockResolvedValueOnce(
            makeResponse({
              status: fixture!.response.status,
              body: fixture!.response.body,
            }),
          );
          const result = await createPassTemplate(VALID_ENV, makeBody());
          expect(result.id).toBe('85b855a5-ec86-4fd6-a48e-892ed143ae0f');
        },
      );

      itFixture(
        'client surfaces an upstreamBody hint when the envelope lacks an id (defensive)',
        async () => {
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
            expect(String(bge.details?.upstreamBody ?? '')).toContain(
              'expected data.identifier',
            );
          }
        },
      );
    },
  );
});
