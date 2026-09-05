/**
 * Schema conformance test — Rule 019 § Schema Contract Drift.
 *
 * Asserts that the backend's `templateSettingsSchema` (apps/backend/src/modules/cards/schemas/request.ts)
 * has the SAME field set as the shared `templateSettingsSchema` (packages/shared/schemas/card.ts).
 *
 * If this fails, it means the local schema has drifted from the shared source of truth.
 * Fix: copy the missing fields from shared to backend request.ts (or vice versa, depending on
 * which side added the field).
 *
 * Phase 5 of IconUploader plan (2026-08-31): added `iconImage` and `backgroundImage` fields.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema as localTemplateSettingsSchema } from '../schemas/request';
import { templateSettingsSchema as sharedTemplateSettingsSchema } from '@saome/shared/schemas';

describe('schema conformance (shared vs backend cards/templateSettingsSchema)', () => {
  it('local schema has the same keys as the shared schema', () => {
    const localKeys = Object.keys(localTemplateSettingsSchema.shape).sort();
    const sharedKeys = Object.keys(sharedTemplateSettingsSchema.shape).sort();
    expect(localKeys).toEqual(sharedKeys);
  });

  it('shared schema has the iconImage field (Rule 019 § 4.1 — Phase 5)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('iconImage');
  });

  it('shared schema has the backgroundImage field (reserved for BackgroundUploader)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('backgroundImage');
  });

  it('shared schema has the leftField field (Rule 019 § 4.1 — Step 3 fields selector 2026-09-04)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('leftField');
  });

  it('shared schema has the rightField field (Rule 019 § 4.1 — Step 3 fields selector 2026-09-04)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('rightField');
  });

  it('local schema has the iconImage field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('iconImage');
  });

  it('local schema has the backgroundImage field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('backgroundImage');
  });

  it('local schema has the leftField field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('leftField');
  });

  it('local schema has the rightField field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('rightField');
  });

  it('shared schema has the stampGridRows field (Rule 019 § 4.1 — Step 3 stamp grid 2026-09-04)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('stampGridRows');
  });

  it('shared schema has the stampIconId field (Rule 019 § 4.1 — Step 3 stamp grid 2026-09-04)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('stampIconId');
  });

  it('local schema has the stampGridRows field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('stampGridRows');
  });

  it('local schema has the stampIconId field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('stampIconId');
  });

  // ===== Step 5 — 地理位置 + 推播訊息 (Rule 019 § 4.1, plan 2026-09-05) =====

  it('shared schema has the locations field (Rule 019 § 4.1 — Step 5 geolocation)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('locations');
  });

  it('shared schema has the initialMessage field (Rule 019 § 4.1 — Step 5 push notification)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('initialMessage');
  });

  it('local schema has the locations field (4-layer sync — Layer 2, Step 5)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('locations');
  });

  it('local schema has the initialMessage field (4-layer sync — Layer 2, Step 5)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('initialMessage');
  });

  it('shared schema has the notificationRadius field (deprecated 2026-09-06, kept for backward-compat)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('notificationRadius');
  });

  it('local schema has the notificationRadius field (4-layer sync — Layer 2, deprecated)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('notificationRadius');
  });

  it('shared schema has the locationsMaxDistance field (Rule 019 § 4.1 — Step 5 rename 2026-09-06)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('locationsMaxDistance');
  });

  it('local schema has the locationsMaxDistance field (4-layer sync — Layer 2, Step 5 rename 2026-09-06)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('locationsMaxDistance');
  });

  it('shared schema has the locationsDisabled field (Rule 019 § 4.1 — Step 5 toggle 2026-09-06)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('locationsDisabled');
  });

  it('local schema has the locationsDisabled field (4-layer sync — Layer 2, Step 5 toggle 2026-09-06)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('locationsDisabled');
  });

  it('shared locations array caps at LOCATIONS_MAX=10', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    // z.array() is the underlying type; .max(10) puts the constraint on it.
    // We assert via parse() rather than reading internal zod properties.
    expect(() =>
      locationsField.parse(
        Array.from({ length: 11 }, (_, i) => ({
          name: `L${i}`,
          latitude: 0,
          longitude: 0,
        })),
      ),
    ).toThrow();
  });

  it('shared locations latitude is bounded to [-90, 90]', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    expect(() =>
      locationsField.parse([
        { name: 'X', latitude: 95, longitude: 0 },
      ]),
    ).toThrow();
  });

  it('shared locations rejects rows without latitude (REQUIRED 2026-09-06)', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    expect(() =>
      locationsField.parse([
        { name: 'X', longitude: 0 }, // missing latitude
      ]),
    ).toThrow();
  });

  it('shared locations rejects rows without longitude (REQUIRED 2026-09-06)', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    expect(() =>
      locationsField.parse([
        { name: 'X', latitude: 0 }, // missing longitude
      ]),
    ).toThrow();
  });

  it('shared locations accepts rows with relevantText (≤ 100 chars)', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    expect(
      locationsField.parse([
        { name: 'X', latitude: 0, longitude: 0, relevantText: '歡迎光臨 🎉' },
      ]),
    ).toHaveLength(1);
  });

  it('shared locations accepts relevantText=null', () => {
    const locationsField = sharedTemplateSettingsSchema.shape.locations;
    expect(
      locationsField.parse([
        { name: 'X', latitude: 0, longitude: 0, relevantText: null },
      ]),
    ).toHaveLength(1);
  });

  it('shared initialMessage caps at 50 chars', () => {
    const field = sharedTemplateSettingsSchema.shape.initialMessage;
    expect(() => field.parse('x'.repeat(51))).toThrow();
    expect(field.parse('x'.repeat(50))).toBe('x'.repeat(50));
  });

  it('shared locationsMaxDistance accepts null (pass-type default sentinel)', () => {
    const field = sharedTemplateSettingsSchema.shape.locationsMaxDistance;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared locationsMaxDistance accepts integers in [100, 1000]', () => {
    const field = sharedTemplateSettingsSchema.shape.locationsMaxDistance;
    expect(field.parse(100)).toBe(100);
    expect(field.parse(500)).toBe(500);
    expect(field.parse(1000)).toBe(1000);
  });

  it('shared locationsMaxDistance rejects integers below 100', () => {
    const field = sharedTemplateSettingsSchema.shape.locationsMaxDistance;
    expect(() => field.parse(99)).toThrow();
  });

  it('shared locationsMaxDistance rejects integers above 1000', () => {
    const field = sharedTemplateSettingsSchema.shape.locationsMaxDistance;
    expect(() => field.parse(1001)).toThrow();
  });

  it('shared locationsMaxDistance rejects non-integers (e.g. 150.5)', () => {
    const field = sharedTemplateSettingsSchema.shape.locationsMaxDistance;
    expect(() => field.parse(150.5)).toThrow();
  });
});
