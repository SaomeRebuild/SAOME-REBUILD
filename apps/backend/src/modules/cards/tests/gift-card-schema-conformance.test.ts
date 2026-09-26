/**
 * Gift Card schema conformance test (Rule 019 § 3)
 *
 * Asserts that the backend `templateSettingsSchema` (mirror) and the
 * shared `templateSettingsSchema` (source of truth) expose the same set
 * of top-level keys. Drift between these two schemas means requests built
 * from frontend state will fail backend zod validation.
 *
 * 2026-09-27: gift_card Step 6 added two new fields
 * (giftCardAmount, giftCardPoints). This test is the regression guard
 * against future drift on those fields.
 */

import { describe, expect, it } from 'vitest';
import { templateSettingsSchema as backendTemplateSettingsSchema } from '../schemas/request';
import { templateSettingsSchema as sharedTemplateSettingsSchema } from '@saome/shared/schemas/card';

describe('templateSettingsSchema — shared vs backend (Rule 019 § 3 conformance)', () => {
  it('exposes the same set of top-level keys', () => {
    expect(Object.keys(backendTemplateSettingsSchema.shape).sort())
      .toEqual(Object.keys(sharedTemplateSettingsSchema.shape).sort());
  });

  it('includes the giftCardAmount / giftCardPoints keys (2026-09-27)', () => {
    // Drift guard: if a future refactor removes one of these keys from
    // either schema, the user would silently lose data on save.
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardAmount');
    expect(Object.keys(backendTemplateSettingsSchema.shape)).toContain('giftCardPoints');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardAmount');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('giftCardPoints');
  });
});