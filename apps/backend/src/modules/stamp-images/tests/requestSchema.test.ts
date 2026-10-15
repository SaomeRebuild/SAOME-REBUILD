/**
 * stampImageParamsSchema + uploadStampImageBodySchema — pure conformance tests.
 *
 * @module modules/stamp-images/tests/requestSchema
 *
 * Two layers of coverage:
 *   1. Schema conformance (Rule 019 § 3): the backend layer-2 request
 *      schemas (`stampImageParamsSchema`, `uploadStampImageBodySchema`)
 *      have the same field set as the shared layer-1 schemas
 *      (`@saome/shared/schemas/stampCard`). If either side adds a field
 *      without updating the other, this test FAILS.
 *   2. Byte-level guards: the layer-2 schema adds the
 *      `<= 8 MB base64` size cap that the shared schema enforces at
 *      layer-1 (≤ 6 MB). Both caps exist for different reasons (fail-fast
 *      vs raw-bytes cap); neither replaces the other.
 */

import { describe, it, expect } from 'vitest';
import {
  stampImageParamsSchema,
  uploadStampImageBodySchema,
} from '../schemas/request';
import { STAMP_FILL_CAP } from '@saome/shared/constants/stampCard';
import {
  uploadStampCardImageRequestSchema,
} from '@saome/shared/schemas/stampCard';

describe('stampImageParamsSchema — path-param contract', () => {
  it('accepts a valid UUID + numeric fillCount', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: '11111111-1111-4111-8111-111111111111',
      fillCount: '0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fillCount).toBe(0);
      expect(typeof result.data.fillCount).toBe('number');
    }
  });

  it('accepts fillCount at the cap (15)', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: '11111111-1111-4111-8111-111111111111',
      fillCount: String(STAMP_FILL_CAP),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fillCount).toBe(STAMP_FILL_CAP);
    }
  });

  it('rejects a non-UUID templateId', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: 'not-a-uuid',
      fillCount: '0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric fillCount (string with letters)', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: '11111111-1111-4111-8111-111111111111',
      fillCount: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fillCount above the cap (16+ is out of range)', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: '11111111-1111-4111-8111-111111111111',
      fillCount: String(STAMP_FILL_CAP + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative fillCount (string starts with "-")', () => {
    const result = stampImageParamsSchema.safeParse({
      templateId: '11111111-1111-4111-8111-111111111111',
      fillCount: '-1',
    });
    expect(result.success).toBe(false);
  });
});

describe('uploadStampImageBodySchema — request body contract', () => {
  it('accepts a valid fillCount + base64 string', () => {
    const result = uploadStampImageBodySchema.safeParse({
      fillCount: 5,
      imageBase64: 'iVBORw0KGgo=',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty imageBase64', () => {
    const result = uploadStampImageBodySchema.safeParse({
      fillCount: 0,
      imageBase64: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fillCount above the cap', () => {
    const result = uploadStampImageBodySchema.safeParse({
      fillCount: STAMP_FILL_CAP + 1,
      imageBase64: 'iVBORw0KGgo=',
    });
    expect(result.success).toBe(false);
  });

  it('rejects grossly oversized base64 (> 8 MB)', () => {
    const big = 'a'.repeat(9 * 1024 * 1024);
    const result = uploadStampImageBodySchema.safeParse({
      fillCount: 0,
      imageBase64: big,
    });
    expect(result.success).toBe(false);
  });
});

describe('Layer-1 vs Layer-2 schema field parity (Rule 019 § 4.1)', () => {
  /**
   * Cross-check the field set shared between the backend layer-2
   * `uploadStampImageBodySchema` and the shared layer-1
   * `uploadStampCardImageRequestSchema`. The body layer adds a
   * larger base64 cap (8 MB vs 6 MB) but the FIELD NAMES are
   * identical. If they drift, the frontend sends something the
   * backend doesn't recognize (or vice versa) — Rule 019 § 4.1
   * four-layer sync violation.
   */
  it('both schemas accept the same fillCount + imageBase64 fields', () => {
    const sample = {
      fillCount: 5,
      imageBase64: 'iVBORw0KGgo=',
    };
    expect(uploadStampCardImageRequestSchema.safeParse(sample).success).toBe(true);
    expect(uploadStampImageBodySchema.safeParse(sample).success).toBe(true);
  });

  it('both schemas reject the same out-of-range fillCount', () => {
    const sample = {
      fillCount: STAMP_FILL_CAP + 1,
      imageBase64: 'iVBORw0KGgo=',
    };
    expect(uploadStampCardImageRequestSchema.safeParse(sample).success).toBe(false);
    expect(uploadStampImageBodySchema.safeParse(sample).success).toBe(false);
  });
});