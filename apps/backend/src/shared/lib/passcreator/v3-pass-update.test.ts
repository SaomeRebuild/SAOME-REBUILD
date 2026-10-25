/**
 * Conformance tests for the Passcreator V3 per-pass VALUE UPDATE client.
 *
 * @module shared/lib/passcreator/v3-pass-update.test
 *
 * The properties pinned here:
 *
 *   1. **METHOD** — the update uses PATCH, never POST. This is the
 *      single most important detail: the V3 docs state that POST on
 *      an EXISTING pass DELETES the fields you do not supply, so a
 *      POST-based "update" would wipe the holder's name, phone and
 *      barcode.
 *   2. **URL** — `/api/v3/pass/{identifier}`.
 *   3. **BODY** — only the provided fields are sent; the payload
 *      mirrors the create body's `data` wrapper.
 *   4. **DATE FORMAT** — `Y-m-d H:i`.
 *   5. **NON-ASCII** — values survive the round-trip (Rule 027 §
 *      workerd `JSON.stringify` pitfall).
 *   6. **ERRORS** — an upstream failure becomes a `BadGatewayError`.
 *   7. **READ-BACK** — the verification GET reports mismatches.
 *
 * Rule references:
 *   - Rule 000 Part C.3 — third-party errors are converted to
 *     SaomeError at the boundary.
 *   - Rule 027 § workerd JSON.stringify — non-ASCII round-trip.
 *   - Rule 019 § D.3 — third-party API contract.
 */

import { describe, it, expect } from 'vitest';
import { updatePassValues } from '../passcreator';
import { BadGatewayError } from '../saomeError';
import {
  VALID_ENV,
  fetchSpy,
  makeResponse,
} from './__fixtures__';

const IDENTIFIER = 'a0f629e6-6533-40cb-90b8-ef9093bfbb26';

function makeGetSingleBody(genericProperties: Record<string, unknown>) {
  return {
    statusCode: 200,
    success: true,
    description: 'Success',
    errors: [],
    count: 1,
    data: {
      identifier: IDENTIFIER,
      genericProperties,
    },
  };
}

describe('updatePassValues — method and URL', () => {
  it('uses PATCH (NEVER POST — POST deletes unsupplied fields)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 100 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 100 },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.method).not.toBe('POST');
  });

  it('targets /api/v3/pass/{identifier}', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 1 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 1 },
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `https://app.passcreator.com/api/v3/pass/${IDENTIFIER}?async=false`,
    );
  });

  it('URL-encodes the identifier', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({}) }),
      );

    await updatePassValues(VALID_ENV, 'weird/id with space', {
      properties: { balance: 1 },
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      'weird%2Fid%20with%20space',
    );
  });
});

describe('updatePassValues — body shape', () => {
  it('sends the properties inside the `data` wrapper', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 42 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 42 },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ data: { balance: 42 } });
  });

  it('sends ONLY the provided fields (no placeholder for absent ones)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 1 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 1 },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body.data)).toEqual(['balance']);
    expect(body.data).not.toHaveProperty('storedValue');
    expect(body.data).not.toHaveProperty('expirationDate');
  });

  it('includes storedValue when provided', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({
          status: 200,
          body: makeGetSingleBody({ balance: 5, storedValue: 5 }),
        }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      storedValue: 5,
      properties: { balance: 5 },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.data.storedValue).toBe(5);
  });

  it('includes expirationDate in the Passcreator Y-m-d H:i format', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({
          status: 200,
          body: makeGetSingleBody({
            memberExpiry: '2027-10-23 00:00',
            expirationDate: '2027-10-23 00:00',
          }),
        }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      expirationDate: '2027-10-23 00:00',
      properties: { memberExpiry: '2027-10-23 00:00' },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.data.expirationDate).toBe('2027-10-23 00:00');
  });

  it('keeps numeric values as JSON numbers (not currency strings)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 199.99 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 199.99 },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(typeof body.data.balance).toBe('number');
    expect(body.data.balance).toBe(199.99);
  });

  it('preserves non-ASCII values (Rule 027 § workerd JSON.stringify pitfall)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({
          status: 200,
          body: makeGetSingleBody({ memberName: '王小明' }),
        }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { memberName: '王小明' },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.data.memberName).toBe('王小明');
    expect(result.verified).toBe(true);
  });
});

describe('updatePassValues — read-back verification', () => {
  it('reports verified when the read-back matches', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 42 }) }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 42 },
    });

    expect(result.verified).toBe(true);
    expect(result.mismatchedFields).toEqual([]);
    expect(result.identifier).toBe(IDENTIFIER);
  });

  it('reports the mismatched field when the read-back differs', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 7 }) }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 42 },
    });

    expect(result.verified).toBe(false);
    expect(result.mismatchedFields).toEqual(['balance']);
  });

  it('reports a mismatch when Passcreator DROPPED the field entirely', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({}) }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 42 },
    });

    expect(result.verified).toBe(false);
    expect(result.mismatchedFields).toEqual(['balance']);
  });

  it('a failed verification GET does NOT throw (the PATCH already landed)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockRejectedValueOnce(new Error('network down'));

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 42 },
    });

    expect(result.verified).toBe(false);
    expect(result.mismatchedFields).toEqual(['balance']);
  });
});

describe('updatePassValues — upstream errors', () => {
  it('throws BadGatewayError when Passcreator rejects the update', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: {
          success: false,
          errors: [{ property: 'balance', message: 'must be a number' }],
        },
      }),
    );

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, { properties: { balance: 'x' } }),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });

  it('throws BadGatewayError on a network failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, { properties: { balance: 1 } }),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });

  it('throws BadGatewayError when the response is not JSON', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({ status: 200, body: '<html>502</html>' }),
    );

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, { properties: { balance: 1 } }),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });
});

/**
 * The `∞` fallback (2026-10-26).
 *
 * A holder with no expiry date writes the `∞` sentinel into the
 * expiry property. Passcreator accepts that ONLY when the template
 * declares the slot as a `text` field. A template pushed BEFORE the
 * tenant switched the card to "never expires" still declares it as
 * `date`, and Passcreator then rejects the WHOLE PATCH with a 400 —
 * which would also block the other fields (balance / points).
 *
 * So the client retries ONCE without the sentinel and flags the
 * result as `degraded`.
 */
describe('updatePassValues — the "∞" sentinel fallback', () => {
  const INFINITY = '∞';

  it('sends the "∞" sentinel VERBATIM (not \\u-escaped) in the PATCH body', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ memberExpiry: INFINITY }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { memberExpiry: INFINITY },
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const rawBody = init.body as string;
    expect(rawBody).toContain(INFINITY);
    expect(rawBody).not.toContain('\\u221e');
  });

  it('retries WITHOUT the sentinel when the upstream rejects it with a 400', async () => {
    fetchSpy
      // 1st PATCH → 400 (the template still declares the slot as `date`).
      .mockResolvedValueOnce(
        makeResponse({
          status: 400,
          body: {
            success: false,
            errors: [{ property: 'memberExpiry', message: 'A provided field value is invalid' }],
          },
        }),
      )
      // 2nd PATCH (no sentinel) → 200.
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      // Read-back GET.
      .mockResolvedValueOnce(
        makeResponse({
          status: 200,
          body: makeGetSingleBody({ memberExpiry: '2027-10-23 00:00', balance: 100 }),
        }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { memberExpiry: INFINITY, balance: 100 },
    });

    // The retry went out WITHOUT the sentinel, but WITH the other fields.
    const retryInit = fetchSpy.mock.calls[1]?.[1] as RequestInit;
    const retryBody = JSON.parse(retryInit.body as string);
    expect(retryBody.data).not.toHaveProperty('memberExpiry');
    expect(retryBody.data.balance).toBe(100);

    // The caller is told the update was only partially applied.
    expect(result.degraded).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.mismatchedFields).toContain('memberExpiry');
  });

  it('leaves the normal-path PATCH body UNCHANGED (single PATCH, no key removal)', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 100, points: 5 }) }),
      );

    await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 100, points: 5 },
    });

    // Exactly ONE upstream call before the verification GET — the
    // fallback must not fire on the happy path.
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ data: { balance: 100, points: 5 } });
  });

  it('does NOT retry when the payload carries no sentinel', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 400,
        body: { success: false, errors: [{ property: 'balance', message: 'must be a number' }] },
      }),
    );

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, { properties: { balance: 'x' } }),
    ).rejects.toBeInstanceOf(BadGatewayError);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows the ORIGINAL error when the retry also fails', async () => {
    fetchSpy.mockResolvedValue(
      makeResponse({
        status: 400,
        body: { success: false, errors: [{ property: 'memberExpiry', message: 'A provided field value is invalid' }] },
      }),
    );

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, {
        properties: { memberExpiry: INFINITY },
      }),
    ).rejects.toBeInstanceOf(BadGatewayError);

    // Two attempts: the original + the retry.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a non-400 upstream failure (500)', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeResponse({
        status: 500,
        body: { success: false, errors: [{ property: 'memberExpiry', message: 'boom' }] },
      }),
    );

    await expect(
      updatePassValues(VALID_ENV, IDENTIFIER, {
        properties: { memberExpiry: INFINITY },
      }),
    ).rejects.toBeInstanceOf(BadGatewayError);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('reports degraded=false for a normal (fully applied) update', async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse({ status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        makeResponse({ status: 200, body: makeGetSingleBody({ balance: 100 }) }),
      );

    const result = await updatePassValues(VALID_ENV, IDENTIFIER, {
      properties: { balance: 100 },
    });

    expect(result.degraded).toBe(false);
    expect(result.verified).toBe(true);
  });
});
