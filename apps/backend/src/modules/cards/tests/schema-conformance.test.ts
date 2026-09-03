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
});
