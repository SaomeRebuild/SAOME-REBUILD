/**
 * Stamp Card Image Composition Schema — conformance tests (2026-10-13).
 *
 * Verifies the four-layer schema contract:
 *   1. shared schemas (this file) — input shape, output shape, upload req/resp
 *   2. backend `request.ts` — must mirror shared (tested separately)
 *   3. backend `db/` — type interface (tested separately)
 *   4. service signature — tested separately
 *
 * The tests below are the canonical contract for the **frontend** side.
 * Backend conformance tests in `apps/backend/src/modules/templates/tests/stamp-images-conformance.test.ts`
 * assert the same field set from the other side.
 */

import { describe, it, expect } from 'vitest';
import {
  stampCardImageInputSchema,
  stampCardImageOutputSchema,
  uploadStampCardImageRequestSchema,
  uploadStampCardImageResponseSchema,
  stampCardBackgroundSchema,
} from './stampCard';
import { STAMP_FILL_CAP } from '../constants/stampCard';

const baseInput = {
  rows: 3 as const,
  cols: 5,
  gridColor: 'transparent' as const,
  iconId: 'bell',
  iconColor: '#FF0000',
  background: { type: 'color' as const, value: '#FFFFFF' },
  fillCount: 0,
};

describe('stampCardImageInputSchema', () => {
  it('accepts a valid input with fillCount=0 (CardBuilder pre-render)', () => {
    const result = stampCardImageInputSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it('accepts fillCount up to STAMP_FILL_CAP inclusive', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      fillCount: STAMP_FILL_CAP,
    });
    expect(result.success).toBe(true);
  });

  it('rejects fillCount > STAMP_FILL_CAP (defensive cap)', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      fillCount: STAMP_FILL_CAP + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative fillCount', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      fillCount: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer fillCount (1.5 is not allowed)', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      fillCount: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects gridColor that is not "transparent" (design contract)', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      gridColor: 'black',
    });
    expect(result.success).toBe(false);
  });

  it('rejects gridColor that is a transparent rgba string (must be the literal "transparent")', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      gridColor: 'rgba(0,0,0,0)',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an image background with a URL', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      background: { type: 'image', url: 'https://r2.example.com/bg.png' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an image background with empty URL', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      background: { type: 'image', url: '' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 6-digit hex color with or without "#" prefix', () => {
    for (const value of ['#FF0000', 'FF0000', '#abcdef', 'ABCDEF']) {
      const result = stampCardImageInputSchema.safeParse({
        ...baseInput,
        iconColor: value,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects a 3-digit hex shorthand', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      iconColor: '#F00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts accentColor when provided', () => {
    const result = stampCardImageInputSchema.safeParse({
      ...baseInput,
      accentColor: '#00FF00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects rows outside the 1..4 range', () => {
    for (const rows of [0, 5, 100]) {
      const result = stampCardImageInputSchema.safeParse({ ...baseInput, rows });
      expect(result.success).toBe(false);
    }
  });

  it('rejects cols outside the 1..5 range', () => {
    for (const cols of [0, 6, 100]) {
      const result = stampCardImageInputSchema.safeParse({ ...baseInput, cols });
      expect(result.success).toBe(false);
    }
  });
});

describe('stampCardBackgroundSchema (discriminated union)', () => {
  it('accepts color background', () => {
    const result = stampCardBackgroundSchema.safeParse({
      type: 'color',
      value: '#FFFFFF',
    });
    expect(result.success).toBe(true);
  });

  it('accepts image background', () => {
    const result = stampCardBackgroundSchema.safeParse({
      type: 'image',
      url: 'https://r2.example.com/bg.png',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown discriminator', () => {
    const result = stampCardBackgroundSchema.safeParse({
      type: 'gradient',
      from: '#FFF',
      to: '#000',
    });
    expect(result.success).toBe(false);
  });
});

describe('stampCardImageOutputSchema', () => {
  it('accepts a valid output with hex SHA-256 blobHash', () => {
    const hash = 'a'.repeat(64);
    const result = stampCardImageOutputSchema.safeParse({
      blobHash: hash,
      dimensions: { width: 1024, height: 640 },
      byteLength: 12345,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-64-char blobHash', () => {
    const result = stampCardImageOutputSchema.safeParse({
      blobHash: 'a'.repeat(63),
      dimensions: { width: 1024, height: 640 },
      byteLength: 12345,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an uppercase blobHash (lowercase convention)', () => {
    const result = stampCardImageOutputSchema.safeParse({
      blobHash: 'A'.repeat(64),
      dimensions: { width: 1024, height: 640 },
      byteLength: 12345,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero or negative dimensions', () => {
    for (const dims of [
      { width: 0, height: 640 },
      { width: 1024, height: 0 },
      { width: -1, height: 640 },
    ]) {
      const result = stampCardImageOutputSchema.safeParse({
        blobHash: 'a'.repeat(64),
        dimensions: dims,
        byteLength: 12345,
      });
      expect(result.success).toBe(false);
    }
  });
});

describe('uploadStampCardImageRequestSchema', () => {
  it('accepts a valid upload request (small base64)', () => {
    // 16 bytes raw = 24 base64 chars (with padding)
    const base64 = Buffer.from('iVBORw0KGgo=').toString('base64');
    const result = uploadStampCardImageRequestSchema.safeParse({
      fillCount: 0,
      imageBase64: base64,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an oversized base64 string (defense before zod reaches the service)', () => {
    // 6 MB base64 string — well above the 6 MB cap.
    const huge = 'a'.repeat(7 * 1024 * 1024);
    const result = uploadStampCardImageRequestSchema.safeParse({
      fillCount: 0,
      imageBase64: huge,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty imageBase64', () => {
    const result = uploadStampCardImageRequestSchema.safeParse({
      fillCount: 0,
      imageBase64: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects fillCount outside the cap', () => {
    const base64 = Buffer.from('iVBORw0KGgo=').toString('base64');
    const result = uploadStampCardImageRequestSchema.safeParse({
      fillCount: STAMP_FILL_CAP + 1,
      imageBase64: base64,
    });
    expect(result.success).toBe(false);
  });
});

describe('uploadStampCardImageResponseSchema', () => {
  it('accepts a valid upload response', () => {
    const result = uploadStampCardImageResponseSchema.safeParse({
      r2Key: 'tenants/abc/templates/def/stamp-0.png',
      byteHash: 'b'.repeat(64),
      byteLength: 54321,
      uploadedAt: '2026-10-13T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty r2Key', () => {
    const result = uploadStampCardImageResponseSchema.safeParse({
      r2Key: '',
      byteHash: 'b'.repeat(64),
      byteLength: 54321,
      uploadedAt: '2026-10-13T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});
