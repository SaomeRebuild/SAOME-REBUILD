/**
 * Unit tests — template settings multipass section.
 *
 * @module shared/schemas/card/templateSettings/multipass.test
 * @description Covers the flat `templates.settings` JSONB schema for the
 * multipass fields.
 *
 * The remaining sections are covered by their sibling test files.
 */

import { describe, it, expect } from 'vitest';
import { templateSettingsSchema } from './index';

describe('templateSettingsSchema — multipassTiers[].perSpendAmount (multipass, 2026-10-26)', () => {
  // Regression guard: the shared schema used to declare `perSpendAmount` as
  // `z.number().positive()`, which accepts any value > 0 (e.g. 0.005).
  // The backend mirror required >= MULTIPASS_STAMPS_PER_SPEND_MIN (0.01),
  // so the shared copy was strictly more permissive than the layer that
  // actually validates production traffic. The two layers are now the same
  // object (Rule 019 § 4.1), so the lower bound must live here too.
  const tier = (overrides: Record<string, unknown>) => ({
    name: 'tier',
    stampsNeeded: 0,
    ...overrides,
  });

  it('rejects perSpendAmount = 0.005 (below the 0.01 lower bound)', () => {
    const result = templateSettingsSchema.safeParse({
      multipassTiers: [tier({ perSpendAmount: 0.005 })],
    });
    expect(result.success).toBe(false);
  });

  it('accepts perSpendAmount = 0.01 (the lower bound)', () => {
    const result = templateSettingsSchema.safeParse({
      multipassTiers: [tier({ perSpendAmount: 0.01 })],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.multipassTiers?.[0]?.perSpendAmount).toBe(0.01);
    }
  });

  it('rejects perSpendAmount = 0', () => {
    const result = templateSettingsSchema.safeParse({
      multipassTiers: [tier({ perSpendAmount: 0 })],
    });
    expect(result.success).toBe(false);
  });

  it('accepts perSpendAmount = null (not filled in)', () => {
    const result = templateSettingsSchema.safeParse({
      multipassTiers: [tier({ perSpendAmount: null })],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.multipassTiers?.[0]?.perSpendAmount).toBe(null);
    }
  });
});
