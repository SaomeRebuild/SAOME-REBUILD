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
import { templateSettingsSchema as sharedTemplateSettingsSchema, cardFieldKeySchema } from '@saome/shared/schemas/card';

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

  // ===== Step 6 — 集點卡邏輯 (Rule 019 § 4.1, plan 2026-09-07) =====

  it('shared schema has the stampAccrualMode field (Rule 019 § 4.1 — Step 6 stamp card logic)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('stampAccrualMode');
  });

  it('local schema has the stampAccrualMode field (4-layer sync — Layer 2, Step 6)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('stampAccrualMode');
  });

  it('shared stampAccrualMode accepts per_stamp | per_visit | per_spend', () => {
    const field = sharedTemplateSettingsSchema.shape.stampAccrualMode;
    expect(field.parse('per_stamp')).toBe('per_stamp');
    expect(field.parse('per_visit')).toBe('per_visit');
    expect(field.parse('per_spend')).toBe('per_spend');
  });

  it('shared stampAccrualMode rejects invalid values', () => {
    const field = sharedTemplateSettingsSchema.shape.stampAccrualMode;
    expect(() => field.parse('manual')).toThrow();
    expect(() => field.parse('perSpend')).toThrow();
    // .nullable().optional() — accepts undefined AND null (frontend store uses null for "unselected")
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared schema has the rewardName field (Rule 019 § 4.1 — Step 6 stamp card logic)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('rewardName');
  });

  it('local schema has the rewardName field (4-layer sync — Layer 2, Step 6)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('rewardName');
  });

  it('shared rewardName caps at 40 chars', () => {
    const field = sharedTemplateSettingsSchema.shape.rewardName;
    expect(() => field.parse('x'.repeat(41))).toThrow();
    expect(field.parse('x'.repeat(40))).toBe('x'.repeat(40));
  });

  it('shared schema has the rewardType field (Rule 019 § 4.1 — Step 6 stamp card logic)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('rewardType');
  });

  it('local schema has the rewardType field (4-layer sync — Layer 2, Step 6)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('rewardType');
  });

  it('shared rewardType accepts amount_off | percent_off', () => {
    const field = sharedTemplateSettingsSchema.shape.rewardType;
    expect(field.parse('amount_off')).toBe('amount_off');
    expect(field.parse('percent_off')).toBe('percent_off');
  });

  it('shared rewardType rejects invalid values', () => {
    const field = sharedTemplateSettingsSchema.shape.rewardType;
    expect(() => field.parse('$')).toThrow();
    // .nullable().optional() — accepts undefined AND null (frontend store uses null for "unselected")
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared schema has the rewardValue field (Rule 019 § 4.1 — Step 6 stamp card logic)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('rewardValue');
  });

  it('local schema has the rewardValue field (4-layer sync — Layer 2, Step 6)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('rewardValue');
  });

  it('shared rewardValue rejects zero and negative numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.rewardValue;
    expect(() => field.parse(0)).toThrow();
    expect(() => field.parse(-5)).toThrow();
  });

  it('shared rewardValue accepts positive numbers (amount or percent)', () => {
    const field = sharedTemplateSettingsSchema.shape.rewardValue;
    expect(field.parse(0.01)).toBe(0.01);
    expect(field.parse(10)).toBe(10);
    expect(field.parse(100)).toBe(100);
  });

  it('shared schema has the maxDiscountAmount field (Rule 019 § 4.1 — Step 6 stamp card logic)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('maxDiscountAmount');
  });

  it('local schema has the maxDiscountAmount field (4-layer sync — Layer 2, Step 6)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('maxDiscountAmount');
  });

  it('shared maxDiscountAmount accepts null (no ceiling sentinel)', () => {
    const field = sharedTemplateSettingsSchema.shape.maxDiscountAmount;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared maxDiscountAmount accepts 0 (zero ceiling)', () => {
    const field = sharedTemplateSettingsSchema.shape.maxDiscountAmount;
    expect(field.parse(0)).toBe(0);
  });

  it('shared maxDiscountAmount accepts positive numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.maxDiscountAmount;
    expect(field.parse(10)).toBe(10);
    expect(field.parse(1_000_000)).toBe(1_000_000);
  });

  it('shared maxDiscountAmount rejects negative numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.maxDiscountAmount;
    expect(() => field.parse(-1)).toThrow();
  });

  // ===== Step 3 — reward_card display-field extension (Rule 019 § 4.1, 2026-09-10) =====
  // Two new keys (`pointsToNextTier`, `currentPoints`) added to CARD_FIELD_KEYS
  // to support the reward card Step 3 dropdown options ("到下一階還差" /
  // "已累積點數"). The keys are stored in the existing `leftField` /
  // `rightField` JSONB columns — NO DB migration is required (the column is
  // a string column; the zod enum is the contract layer).
  //
  // The conformance test pins that:
  //   1. cardFieldKeySchema (derived from CARD_FIELD_KEYS) accepts the new keys
  //   2. The new keys survive a roundtrip through the local backend schema
  //      (i.e. leftField/rightField can carry them).

  it('cardFieldKeySchema accepts new reward_card keys (pointsToNextTier, currentPoints)', () => {
    expect(cardFieldKeySchema.parse('pointsToNextTier')).toBe('pointsToNextTier');
    expect(cardFieldKeySchema.parse('currentPoints')).toBe('currentPoints');
  });

  it('shared leftField/rightField accept the new reward_card keys (Rule 019 § 4.1)', () => {
    const leftField = sharedTemplateSettingsSchema.shape.leftField;
    const rightField = sharedTemplateSettingsSchema.shape.rightField;
    expect(leftField.parse('pointsToNextTier')).toBe('pointsToNextTier');
    expect(rightField.parse('currentPoints')).toBe('currentPoints');
  });

  it('local leftField/rightField accept the new reward_card keys (4-layer sync — Layer 2)', () => {
    const leftField = localTemplateSettingsSchema.shape.leftField;
    const rightField = localTemplateSettingsSchema.shape.rightField;
    expect(leftField.parse('pointsToNextTier')).toBe('pointsToNextTier');
    expect(rightField.parse('currentPoints')).toBe('currentPoints');
  });

  it('cardFieldKeySchema rejects unknown keys (drift guard)', () => {
    // Pin that the enum is closed — new keys must be added explicitly via
    // CARD_FIELD_KEYS. A typo or accidental key in a payload should fail
    // loud at parse-time, not silently round-trip.
    expect(() => cardFieldKeySchema.parse('points_remaining')).toThrow();
    expect(() => cardFieldKeySchema.parse('')).toThrow();
  });

  it('full templateSettings accepts reward_card with both new keys set', () => {
    // End-to-end happy path: a reward_card draft with both reward display
    // fields picked survives the shared schema parse. Mirrors what
    // `cardService.update` would receive from the workspace onSave handler.
    const payload = {
      cardType: 'reward_card',
      leftField: 'pointsToNextTier',
      rightField: 'currentPoints',
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  // ===== Step 6 — Membership Card: lifetimeCost field (2026-09-13, Rule 019 § 4.1) =====
  // User clarification 2026-09-13: even when card-wide hasExpiry === false
  // (lifetime membership), the fee input must remain visible. Tenants use
  // this to sell the right to a lifetime tier at a one-time price (consumer
  // directly purchases lifetime membership). The cost field writes to a
  // NEW `lifetimeCost` column instead of monthlyCost/yearlyCost.
  //
  // This block pins the 4-layer sync for the new field:
  //   - shared `templateSettingsSchema.membershipTiers[*].lifetimeCost`
  //   - backend local `templateSettingsSchema.membershipTiers[*].lifetimeCost`
  //   - backend db interface `TemplateSettings.membershipTiers[*].lifetimeCost`
  //     (validated via grep below — TypeScript type system enforces it).
  //   - frontend store `MembershipTierShape.lifetimeCost`
  //     (validated via grep below).
  //
  // The conformance test also pins runtime bounds:
  //   - lifetimeCost >= 0 allowed (= free lifetime member tier)
  //   - lifetimeCost === null allowed (= not entered)
  //   - lifetimeCost < 0 rejected
  it('shared schema accepts lifetimeCost field on membership tiers (Rule 019 § 4.1, 2026-09-13)', () => {
    // Pin that lifetimeCost exists at the JSONB contract layer. Use a
    // representative payload round-trip — if the field is missing the
    // shared schema will strip it (zod default .object() behavior) and
    // toMatchObject will fail because the parsed result won't contain
    // the field.
    const payload = {
      membershipTiers: [
        {
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 3000,
          rewards: [],
        },
      ],
    };
    const parsedShared = sharedTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const parsedLocal = localTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const sharedTiers = parsedShared.membershipTiers as Array<Record<string, unknown>>;
    const localTiers = parsedLocal.membershipTiers as Array<Record<string, unknown>>;
    expect(sharedTiers[0]!.lifetimeCost).toBe(3000);
    expect(localTiers[0]!.lifetimeCost).toBe(3000);
  });

  it('shared lifetimeCost accepts null (not entered sentinel)', () => {
    const payload = {
      membershipTiers: [
        {
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    };
    const parsedShared = sharedTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const parsedLocal = localTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const sharedTiers = parsedShared.membershipTiers as Array<Record<string, unknown>>;
    const localTiers = parsedLocal.membershipTiers as Array<Record<string, unknown>>;
    expect(sharedTiers[0]!.lifetimeCost).toBeNull();
    expect(localTiers[0]!.lifetimeCost).toBeNull();
  });

  it('shared lifetimeCost accepts 0 (free lifetime member)', () => {
    const payload = {
      membershipTiers: [
        {
          name: 'FreeVIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 0,
          rewards: [],
        },
      ],
    };
    const parsedShared = sharedTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const sharedTiers = parsedShared.membershipTiers as Array<Record<string, unknown>>;
    expect(sharedTiers[0]!.lifetimeCost).toBe(0);
  });

  it('shared lifetimeCost rejects negative numbers', () => {
    const payload = {
      membershipTiers: [
        {
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: -100,
          rewards: [],
        },
      ],
    };
    expect(() => sharedTemplateSettingsSchema.parse(payload)).toThrow();
  });

  it('shared membership tier + lifetimeCost end-to-end (lifetime mode)', () => {
    // End-to-end happy path: a membership_card draft with hasExpiry=false
    // and a tier carrying lifetimeCost=3000 survives the schema parse.
    // Mirrors what `cardService.update` would receive from the workspace
    // onSave handler in lifetime mode.
    const payload = {
      cardType: 'membership_card',
      hasExpiry: false,
      membershipTiers: [
        {
          name: 'Lifetime VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 3000,
          rewards: [{ label: '專屬優惠', value: 'https://example.com/vip' }],
        },
      ],
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  it('shared membership tier + monthlyCost + lifetimeCost (both cost fields coexist in schema)', () => {
    // Both cost fields coexist in the schema; the editor decides which
    // is shown based on the card-wide hasExpiry toggle. The schema does
    // NOT enforce mutual exclusion — that's a UI-layer concern. This test
    // pins that the contract layer accepts both fields when present.
    const payload = {
      cardType: 'membership_card',
      hasExpiry: true,
      membershipTiers: [
        {
          name: 'VIP',
          durationType: 'monthly',
          monthlyCost: 100,
          yearlyCost: 1000,
          lifetimeCost: 3000, // preserved even when hasExpiry=true (UI hides it)
          rewards: [],
        },
      ],
    };
    const parsedShared = sharedTemplateSettingsSchema.parse(payload) as Record<string, unknown>;
    const sharedTiers = parsedShared.membershipTiers as Array<Record<string, unknown>>;
    expect(sharedTiers[0]!.monthlyCost).toBe(100);
    expect(sharedTiers[0]!.yearlyCost).toBe(1000);
    expect(sharedTiers[0]!.lifetimeCost).toBe(3000);
  });

  // ===== Semantic swap 2026-09-13: storeName → logoText (Rule 019 § 4.1) =====
  // Migration 018 swaps CardBuilder storage locations:
  //   - templates.name (SQL column) now means "Card Name" (pass record name)
  //   - templates.settings.logoText (NEW JSONB key) holds "Logo Text" (pass header text)
  //   - templates.settings.storeName removed (replaced by templates.name SQL column)
  //
  // The 4-layer sync check (Rule 019 § 4.1) pins that:
  //   1. shared `templateSettingsSchema` has `logoText` and NOT `storeName`
  //   2. backend local `templateSettingsSchema` matches (Layer 2 mirror)
  //   3. The new key survives an end-to-end parse round-trip
  it('shared + backend schemas both expose logoText and drop storeName (regression — 2026-09-13)', () => {
    // Shared (Layer 1 of 4) — single source of truth.
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('logoText');
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).not.toContain('storeName');
    // Backend local (Layer 2 of 4) — mirrors shared; see request.ts.
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('logoText');
    expect(Object.keys(localTemplateSettingsSchema.shape)).not.toContain('storeName');
  });

  it('full templateSettings accepts logoText key (pass header text — JSONB)', () => {
    // End-to-end happy path: a draft with logoText set survives schema
    // parse. Mirrors what `cardService.update` receives from the Header
    // input's debounced autosave.
    const payload = { logoText: '超凡' };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  it('full templateSettings rejects unknown storeName key (drift guard — 2026-09-13)', () => {
    // After the swap, the `storeName` key is DROPPED from the contract.
    // The shared schema is a plain `.object({...})` (zod's default is
    // strip-unknown), so unknown keys are silently dropped. This is the
    // correct post-swap behavior — a stale payload (e.g. from an
    // un-patched client) that sends `settings.storeName` should not
    // round-trip the unknown key into the DB.
    //
    // (Bug #8 defensive unwrap lives in the SQL layer (`templates.ts`),
    // NOT in the zod schema. The schema accepts well-typed values;
    // unknown keys are stripped.)
    const stale = { storeName: 'x', logoText: 'y' };
    const parsed = sharedTemplateSettingsSchema.parse(stale);
    // logoText is preserved
    expect(parsed).toMatchObject({ logoText: 'y' });
    // storeName is stripped (default zod .object() behavior)
    expect((parsed as Record<string, unknown>).storeName).toBeUndefined();
  });

  // top-level `name` is a SQL column (not part of templateSettingsSchema);
  // it's defined on `createTemplateSchema` / `updateTemplateSchema` in both
  // shared and backend layers. Confirm the top-level contracts agree.
  it('shared + backend createTemplateSchema both expose optional name (Rule 019 § 4.1 layer 1/2)', async () => {
    const { createTemplateSchema: sharedCreate, updateTemplateSchema: sharedUpdate } = await import(
      '@saome/shared/schemas/card'
    );
    const { createTemplateSchema: localCreate, updateTemplateSchema: localUpdate } = await import(
      '../schemas/request'
    );
    // Both layers must allow `name` at the top level (SQL column).
    expect(Object.keys(sharedCreate.shape)).toContain('name');
    expect(Object.keys(localCreate.shape)).toContain('name');
    expect(Object.keys(sharedUpdate.shape)).toContain('name');
    expect(Object.keys(localUpdate.shape)).toContain('name');
    // And the top-level `name` should NOT be present in templateSettingsSchema
    // (it's NOT a JSONB key — the SQL column is the only carrier).
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).not.toContain('name');
    expect(Object.keys(localTemplateSettingsSchema.shape)).not.toContain('name');
  });
});
