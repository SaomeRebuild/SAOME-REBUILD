/**
 * Unit tests for packages/shared/schemas/card.ts.
 *
 * Coverage focuses on the stamp grid fields (added 2026-09-04) and the
 * Step 4 card-info fields (added 2026-09-04); the rest of the schema is
 * exercised by the backend schema-conformance suite.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './card';

describe('templateSettingsSchema — stamp grid fields', () => {
  it('accepts stampGridRows = 1', () => {
    const result = templateSettingsSchema.safeParse({ stampGridRows: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts stampGridRows = 2, 3, 4', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: 2 }).success).toBe(true);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 3 }).success).toBe(true);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 4 }).success).toBe(true);
  });

  it('rejects stampGridRows = 0 or 5 (out of union)', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: 0 }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ stampGridRows: 5 }).success).toBe(false);
  });

  it('rejects non-numeric stampGridRows', () => {
    expect(templateSettingsSchema.safeParse({ stampGridRows: '2' }).success).toBe(false);
    expect(templateSettingsSchema.safeParse({ stampGridRows: null }).success).toBe(false);
  });

  it('accepts stampIconId as any non-empty string', () => {
    const result = templateSettingsSchema.safeParse({ stampIconId: 'bell' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stampIconId).toBe('bell');
  });

  it('accepts stampIconId as empty string (icon unset, preview shows placeholder)', () => {
    const result = templateSettingsSchema.safeParse({ stampIconId: '' });
    expect(result.success).toBe(true);
  });

  it('accepts both fields omitted (default for non-stamp card types)', () => {
    const result = templateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

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
