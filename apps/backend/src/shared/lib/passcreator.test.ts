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

/**
 * Minimal Passcreator env shape that the client reads via `requireEnv`.
 */
const VALID_ENV = {
  PASSCREATOR_API_URL: 'https://api.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
};

/**
 * Minimal template body — fields unused by these tests are defaulted.
 */
function makeBody(overrides: Partial<{ name: string }> = {}) {
  return {
    passTypeId: VALID_ENV.PASSCREATOR_PASS_TYPE_ID,
    name: overrides.name ?? 'Café Rewards',
    description: 'desc',
    organizationName: 'Café Co.',
    colors: { backgroundColor: '0F0F23', foregroundColor: 'F8FAFC' },
    barcode: { format: 'PKBarcodeFormatQR' as const },
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
  it('returns the parsed id on 2xx', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 201, body: { id: 'pc-123' } }));
    const result = await createPassTemplate(VALID_ENV, makeBody());
    expect(result).toEqual({ id: 'pc-123' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.passcreator.com/api/v2/passes/templates');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const headers = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
  });
  it('strips trailing slash from API URL', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-1' } }));
    await createPassTemplate({ ...VALID_ENV, PASSCREATOR_API_URL: 'https://api.passcreator.com/' }, makeBody());
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.passcreator.com/api/v2/passes/templates');
  });
  it('throws BadGatewayError when response is missing id', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { foo: 'bar' } }));
    await expect(createPassTemplate(VALID_ENV, makeBody())).rejects.toBeInstanceOf(BadGatewayError);
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
  it('returns the existing id on 2xx with id', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-existing' } }));
    const result = await updatePassTemplate(VALID_ENV, 'pc-existing', makeBody());
    expect(result.id).toBe('pc-existing');
  });
  it('encodes the id in the URL (URL-safe)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-with spaces' } }));
    await updatePassTemplate(VALID_ENV, 'pc-with spaces', makeBody());
    // Space should be encoded as %20 (or +); both are technically valid.
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/\/api\/v2\/passes\/templates\/pc-with(%20|\+)spaces$/);
  });
  it('uses PUT method (full template body convention)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 200, body: { id: 'pc-1' } }));
    await updatePassTemplate(VALID_ENV, 'pc-1', makeBody());
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
  });
  it('falls back to existing id when response lacks id (e.g. 204 No Content)', async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse({ status: 204, body: null }));
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
