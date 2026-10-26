/**
 * Unit tests — template settings Step 4 card-info fields.
 *
 * @module shared/schemas/card/templateSettings/step4.test
 * @description Covers the flat `templates.settings` JSONB schema for the
 * Step 4 card-info fields.
 *
 * The remaining sections are covered by their sibling test files.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './index';

describe('templateSettingsSchema — Step 4 card-info fields (2026-09-04)', () => {
  it('accepts description ≤ 200 chars', () => {
    const result = templateSettingsSchema.safeParse({
      description: 'a'.repeat(200),
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.description).toHaveLength(200);
  });

  it('rejects description > 200 chars', () => {
    const result = templateSettingsSchema.safeParse({
      description: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts description as empty string (UI enforces non-empty via isStep4Valid)', () => {
    const result = templateSettingsSchema.safeParse({ description: '' });
    expect(result.success).toBe(true);
  });

  it('accepts backFields array with valid label/value pairs', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [
        { label: 'Email', value: 'foo@example.com' },
        { label: 'Phone', value: '+1234567890' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.backFields).toHaveLength(2);
  });

  it('rejects backFields entry with label > 40 chars', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [{ label: 'a'.repeat(41), value: 'ok' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects backFields entry with value > 80 chars', () => {
    const result = templateSettingsSchema.safeParse({
      backFields: [{ label: 'ok', value: 'a'.repeat(81) }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts links array with valid label/value pairs', () => {
    const result = templateSettingsSchema.safeParse({
      links: [
        { label: 'Website', value: 'https://example.com' },
        { label: 'Phone', value: 'tel:+1234567890' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.links).toHaveLength(2);
  });

  it('accepts links with value up to 2048 chars (PassKit per-field byte limit)', () => {
    const result = templateSettingsSchema.safeParse({
      links: [{ label: 'long', value: 'https://x.com/?q=' + 'a'.repeat(2030) }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects links entry with value > 2048 chars', () => {
    const result = templateSettingsSchema.safeParse({
      links: [{ label: 'long', value: 'a'.repeat(2049) }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all three Step 4 fields omitted (defaults for fresh drafts)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts all three Step 4 fields together with other Step 1-3 fields (flat merge)', () => {
    const result = templateSettingsSchema.safeParse({
      name: 'Test',
      cardType: 'membership_card',
      description: 'Hello',
      backFields: [{ label: 'Email', value: 'a@b.c' }],
      links: [{ label: 'Web', value: 'https://x.com' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Hello');
      expect(result.data.backFields).toHaveLength(1);
      expect(result.data.links).toHaveLength(1);
    }
  });
});

// ===== Step 5 — 地理位置 + 推播訊息 (2026-09-06 refactor) =====
