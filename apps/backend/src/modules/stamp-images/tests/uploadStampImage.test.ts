/**
 * uploadStampImage service — unit tests (no DB, no real R2).
 *
 * @module modules/stamp-images/tests/uploadStampImage
 *
 * Coverage targets (Phase 3.2):
 *   1. PNG magic header rejection (non-PNG bytes must throw ValidationError).
 *   2. Oversize rejection (decoded bytes > 4 MB cap throws ValidationError).
 *   3. Hash determinism (same bytes → same SHA-256 hex).
 *   4. Base64 decode defensive handling (whitespace, bad alphabet).
 *   5. `buildStampImageKey` produces the canonical
 *      `tenants/<id>/templates/<id>/stamp-N.png` shape.
 *   6. `assertRawByteLength` rejects empty + oversized buffers.
 *
 * The DB + R2 surface is mocked at the db/stampImages + service module
 * boundaries so we don't need live Postgres / R2 in CI. Module-level
 * `vi.mock` replaces the imported helpers — the service under test
 * sees the mocked implementations, not the real SQL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStampImageKey,
  sha256Hex,
  decodeBase64ToBytes,
  ensureTemplateBelongsToTenantOr404,
} from '../services/uploadStampImage';
import { ValidationError } from '@/shared/lib/saomeError';

// === Module mocks ===
// `vi.mock` factories are hoisted to the top of the file, BEFORE the
// `const mockInsertPending = ...` declarations below. To reference the
// mocks from inside the factory (without TDZ errors), hoist them via
// `vi.hoisted()` so the consts exist at factory-call time.
const mocks = vi.hoisted(() => ({
  insertPending: vi.fn(),
  markUploaded: vi.fn(),
  markFailed: vi.fn(),
  // 2026-10-14 — re-publish duplicate-key regression. The service
  // MUST delete any pre-existing `uploaded` row before INSERTing a
  // new `pending` row, or the partial unique index
  // `template_stamp_card_images_uploaded_uidx` will reject the
  // subsequent UPDATE.
  deleteUploaded: vi.fn(),
}));

vi.mock('../db/stampImages', () => ({
  insertPendingStampImage: (...args: unknown[]) => mocks.insertPending(...args),
  markStampImageUploaded: (...args: unknown[]) => mocks.markUploaded(...args),
  markStampImageFailed: (...args: unknown[]) => mocks.markFailed(...args),
  // Pre-existing mock (kept for any future cleanup flow).
  deletePendingStampImage: vi.fn(async () => undefined),
  // 2026-10-14 — new mock for the re-publish / existing-uploaded-row
  // path. Returns 1 by default (mirroring the real DB function which
  // returns the count of deleted rows). Tests assert this directly.
  deleteUploadedStampImage: (...args: unknown[]) => mocks.deleteUploaded(...args),
  findUploadedStampImage: vi.fn(async () => null),
}));

import { uploadStampImage } from '../services/uploadStampImage';

// === Fixtures ===
// PNG file header (8 bytes): 89 50 4E 47 0D 0A 1A 0A.
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_BODY_TAIL = new Uint8Array(120); // padding to make a valid-looking PNG body

function makeFakePngBytes(extraBytes = 0): Uint8Array {
  const out = new Uint8Array(PNG_MAGIC.length + PNG_BODY_TAIL.length + extraBytes);
  out.set(PNG_MAGIC, 0);
  out.set(PNG_BODY_TAIL, PNG_MAGIC.length);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] as number);
  }
  // `btoa` is global in workerd / browser — vitest's node pool also
  // exposes it in modern versions.
  return btoa(bin);
}

function makeBucketMock(returnUndefined = false): { put: ReturnType<typeof vi.fn> } {
  return {
    put: vi.fn(async (key: string, _bytes: Uint8Array, _opts: unknown) =>
      returnUndefined ? undefined : { key, versionId: 'v1' },
    ),
  };
}

// === Tests ===
describe('buildStampImageKey — canonical R2 key shape', () => {
  it('produces tenants/<id>/templates/<id>/stamp-N.png', () => {
    expect(buildStampImageKey('tenant-1', 'tpl-1', 0)).toBe(
      'tenants/tenant-1/templates/tpl-1/stamp-0.png',
    );
    expect(buildStampImageKey('tenant-1', 'tpl-1', 7)).toBe(
      'tenants/tenant-1/templates/tpl-1/stamp-7.png',
    );
    expect(buildStampImageKey('tenant-1', 'tpl-1', 15)).toBe(
      'tenants/tenant-1/templates/tpl-1/stamp-15.png',
    );
  });
});

describe('sha256Hex — deterministic hex digest', () => {
  it('produces 64-char lowercase hex', async () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03]);
    const hex = await sha256Hex(bytes);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the canonical SHA-256 of an empty buffer', async () => {
    const hex = await sha256Hex(new Uint8Array(0));
    expect(hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('is deterministic across repeated calls', async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
    const b = await sha256Hex(new Uint8Array([1, 2, 3, 4]));
    expect(a).toBe(b);
  });

  it('differs for different inputs (avalanche)', async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    const b = await sha256Hex(new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
  });
});

describe('decodeBase64ToBytes — defensive decoding', () => {
  it('decodes a known base64 string to the matching bytes', () => {
    const original = 'hello world';
    const b64 = btoa(original);
    const bytes = decodeBase64ToBytes(b64);
    const decoded = Array.from(bytes).map((b) => String.fromCharCode(b as number)).join('');
    expect(decoded).toBe(original);
  });

  it('strips whitespace before decoding (Chrome sometimes wraps long strings)', () => {
    const original = 'hello';
    const b64 = btoa(original);
    const wrapped = ` ${b64.slice(0, 5)}\n${b64.slice(5)} `;
    const bytes = decodeBase64ToBytes(wrapped);
    const decoded = Array.from(bytes).map((b) => String.fromCharCode(b as number)).join('');
    expect(decoded).toBe(original);
  });

  it('rejects empty input with ValidationError', () => {
    expect(() => decodeBase64ToBytes('')).toThrow(ValidationError);
    expect(() => decodeBase64ToBytes('   ')).toThrow(ValidationError);
  });

  it('rejects illegal alphabet characters with ValidationError', () => {
    // '!' is NOT in the base64 alphabet → must reject.
    expect(() => decodeBase64ToBytes('aaaa!')).toThrow(ValidationError);
  });
});

describe('ensureTemplateBelongsToTenantOr404 — tenant ownership gate', () => {
  it('accepts a matching tenant id', () => {
    expect(() =>
      ensureTemplateBelongsToTenantOr404('tenant-A', 'tenant-A'),
    ).not.toThrow();
  });

  it('throws NotFoundError when tenant ids differ', () => {
    expect(() =>
      ensureTemplateBelongsToTenantOr404('tenant-A', 'tenant-B'),
    ).toThrow();
  });

  it('throws NotFoundError when template tenant id is null (defensive)', () => {
    expect(() =>
      ensureTemplateBelongsToTenantOr404(null, 'tenant-A'),
    ).toThrow();
  });
});

describe('uploadStampImage — defensive byte validation', () => {
  /**
   * The mocked `db/stampImages` module helpers return stable fixtures
   * so the service can complete its atomic-ish flow. Each test mutates
   * the mocks via the module-scoped `mocks` object.
   */
  const pendingRowId = 42;
  const pendingRow = {
    id: pendingRowId,
    templateId: 'tpl-1',
    fillCount: 0,
    r2Key: 'tenants/tenant-1/templates/tpl-1/stamp-0.png',
    byteHash: '0'.repeat(64),
    byteLength: 128,
    status: 'pending' as const,
    uploadedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const uploadedRow = {
    ...pendingRow,
    status: 'uploaded' as const,
    uploadedAt: new Date(),
  };

  let bucketMock: { put: ReturnType<typeof vi.fn> };
  let lastInsertedArgs:
    | {
        templateId: string;
        fillCount: number;
        r2Key: string;
        byteHash: string;
        byteLength: number;
      }
    | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastInsertedArgs = null;
    // 2026-10-14 — default behavior for the re-publish path. Returns
    // 1 (one pre-existing `uploaded` row was removed) by default;
    // individual tests can override per-case.
    mocks.deleteUploaded.mockResolvedValue(1);
    mocks.insertPending.mockImplementation(async (_sql, args) => {
      lastInsertedArgs = args;
      return {
        id: pendingRowId,
        templateId: args.templateId,
        fillCount: args.fillCount,
        r2Key: args.r2Key,
        byteHash: args.byteHash,
        byteLength: args.byteLength,
        status: 'pending' as const,
        uploadedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    // markUploaded returns a row whose r2Key matches whatever was
    // inserted (defensive — production DB layer doesn't auto-correct
    // mismatched r2Key, it just returns the column as-stored).
    mocks.markUploaded.mockImplementation(async (_sql, _rowId) => {
      const inserted = lastInsertedArgs;
      return {
        id: pendingRowId,
        templateId: inserted?.templateId ?? pendingRow.templateId,
        fillCount: inserted?.fillCount ?? pendingRow.fillCount,
        r2Key: inserted?.r2Key ?? pendingRow.r2Key,
        byteHash: inserted?.byteHash ?? pendingRow.byteHash,
        byteLength: inserted?.byteLength ?? pendingRow.byteLength,
        status: 'uploaded' as const,
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    mocks.markFailed.mockResolvedValue({ ...pendingRow, status: 'failed' });
    bucketMock = makeBucketMock();
  });

  it('rejects non-PNG bytes with ValidationError (no DB / no R2 writes)', async () => {
    const notPng = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const b64 = bytesToBase64(notPng);

    await expect(
      uploadStampImage({} as never, bucketMock as unknown as R2Bucket, {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 0,
        imageBase64: b64,
      }),
    ).rejects.toThrow(ValidationError);

    expect(mocks.insertPending).not.toHaveBeenCalled();
    expect(bucketMock.put).not.toHaveBeenCalled();
  });

  it('rejects oversized payloads (> 4 MB raw bytes) with ValidationError', async () => {
    // 5 MB of zeros after the PNG magic — magic check passes, size cap trips.
    const big = makeFakePngBytes(5 * 1024 * 1024);
    const b64 = bytesToBase64(big);

    await expect(
      uploadStampImage({} as never, bucketMock as unknown as R2Bucket, {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 0,
        imageBase64: b64,
      }),
    ).rejects.toThrow(ValidationError);

    expect(bucketMock.put).not.toHaveBeenCalled();
  });

  it('happy path: writes pending → R2 → uploaded with deterministic byte hash', async () => {
    const png = makeFakePngBytes(64);
    const b64 = bytesToBase64(png);

    const result = await uploadStampImage(
      {} as never,
      bucketMock as unknown as R2Bucket,
      {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 7,
        imageBase64: b64,
      },
    );

    // 1. Pending row inserted first.
    expect(mocks.insertPending).toHaveBeenCalledTimes(1);
    const inserted = mocks.insertPending.mock.calls[0]![1] as Record<string, unknown>;
    expect(inserted.fillCount).toBe(7);
    expect(inserted.r2Key).toBe('tenants/tenant-1/templates/tpl-1/stamp-7.png');
    expect(inserted.byteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(inserted.byteLength).toBe(png.length);

    // 2. R2 PUT called with the canonical key + image/png content type.
    expect(bucketMock.put).toHaveBeenCalledTimes(1);
    const putArgs = bucketMock.put.mock.calls[0]!;
    expect(putArgs[0]).toBe('tenants/tenant-1/templates/tpl-1/stamp-7.png');
    expect(
      (putArgs[2] as { httpMetadata: { contentType: string } }).httpMetadata.contentType,
    ).toBe('image/png');

    // 3. Row flipped to uploaded.
    expect(mocks.markUploaded).toHaveBeenCalledWith(expect.anything(), pendingRowId);

    // 4. Result shape mirrors `UploadStampCardImageResponse`.
    expect(result.r2Key).toBe('tenants/tenant-1/templates/tpl-1/stamp-7.png');
    expect(result.byteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.byteLength).toBe(png.length);
    expect(result.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('R2 PUT failure path: marks row failed and bubbles up BadGatewayError', async () => {
    // Bucket.put returns undefined → service throws BadGatewayError.
    bucketMock = makeBucketMock(true);

    const png = makeFakePngBytes(32);
    const b64 = bytesToBase64(png);

    await expect(
      uploadStampImage({} as never, bucketMock as unknown as R2Bucket, {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 0,
        imageBase64: b64,
      }),
    ).rejects.toThrow();

    // Pending row was inserted (atomic-ish: DB-first).
    expect(mocks.insertPending).toHaveBeenCalled();
    // R2 was attempted (and failed).
    expect(bucketMock.put).toHaveBeenCalled();
    // Failed status was recorded (audit trail).
    expect(mocks.markFailed).toHaveBeenCalledWith(expect.anything(), pendingRowId);
    // markUploaded was NOT called (we never reached the happy path).
    expect(mocks.markUploaded).not.toHaveBeenCalled();
  });

  /**
   * 2026-10-14 — Re-publish / existing-uploaded-row path.
   *
   * Regression for the live error:
   *   `duplicate key value violates unique constraint
   *    "template_stamp_card_images_uploaded_uidx"`
   *
   * The partial unique index (UNIQUE (template_id, fill_count)
   * WHERE status='uploaded') in migration 022 enforces "one uploaded
   * row per slot". When the user re-publishes a stamp_card, a prior
   * successful publish may have left an `uploaded` row. The service
   * MUST `DELETE` that row BEFORE inserting a new `pending` row —
   * otherwise the subsequent `UPDATE … SET status='uploaded'` trips
   * the partial unique constraint.
   *
   * Test asserts:
   *   1. `deleteUploadedStampImage` is called once with the right args.
   *   2. It runs BEFORE `insertPendingStampImage` (order matters).
   *   3. The full happy path still completes successfully
   *      (delete → insert → R2 → mark uploaded).
   */
  it('re-publish path: deletes any pre-existing uploaded row before INSERT pending', async () => {
    const png = makeFakePngBytes(64);
    const b64 = bytesToBase64(png);

    // Track call order across the db helpers (vitest's
    // `invocationCallOrder` works but coupling to its internal
    // counter is fragile). Use an in-array recorder shared by both
    // mocks for a portable order assertion.
    const callOrder: string[] = [];
    mocks.deleteUploaded.mockImplementation(async () => {
      callOrder.push('delete');
      return 1;
    });
    mocks.insertPending.mockImplementation(async (_sql, args) => {
      callOrder.push('insert');
      lastInsertedArgs = args;
      return {
        id: pendingRowId,
        templateId: args.templateId,
        fillCount: args.fillCount,
        r2Key: args.r2Key,
        byteHash: args.byteHash,
        byteLength: args.byteLength,
        status: 'pending' as const,
        uploadedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    const result = await uploadStampImage(
      {} as never,
      bucketMock as unknown as R2Bucket,
      {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 0,
        imageBase64: b64,
      },
    );

    // 1. deleteUploaded called once with the right (template, fillCount).
    expect(mocks.deleteUploaded).toHaveBeenCalledTimes(1);
    const deleteArgs = mocks.deleteUploaded.mock.calls[0]![1] as Record<string, unknown>;
    expect(deleteArgs.templateId).toBe('tpl-1');
    expect(deleteArgs.fillCount).toBe(0);

    // 2. Order: delete runs BEFORE insert.
    expect(callOrder).toEqual(['delete', 'insert']);

    // 3. Full happy path still completes.
    expect(mocks.insertPending).toHaveBeenCalledTimes(1);
    expect(bucketMock.put).toHaveBeenCalledTimes(1);
    expect(mocks.markUploaded).toHaveBeenCalledWith(expect.anything(), pendingRowId);
    expect(result.r2Key).toBe('tenants/tenant-1/templates/tpl-1/stamp-0.png');
  });

  /**
   * 2026-10-14 — Edge case: a previous run left a `failed` row
   * (e.g. an R2 PUT errored mid-flow). The service must NOT touch
   * that row — `failed` rows are kept for audit per the migration
   * comment ("Multiple failed rows are allowed (kept for audit)").
   * Only `uploaded` rows are deleted.
   *
   * Test asserts that `deleteUploadedStampImage` is the only
   * delete call — no `deletePendingStampImage` is invoked on this
   * path (we use a fresh `pending` row from this run).
   */
  it('does not delete failed rows on a re-publish (only uploaded rows)', async () => {
    const png = makeFakePngBytes(32);
    const b64 = bytesToBase64(png);

    await uploadStampImage(
      {} as never,
      bucketMock as unknown as R2Bucket,
      {
        templateId: 'tpl-1',
        tenantId: 'tenant-1',
        fillCount: 0,
        imageBase64: b64,
      },
    );

    // Only deleteUploaded is called; the audit-trail `failed` rows
    // (from any prior run) are not touched.
    expect(mocks.deleteUploaded).toHaveBeenCalledTimes(1);
  });
});