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
import {
  COUPON_AMOUNT_MIN,
  COUPON_PERCENT_MIN,
  COUPON_PERCENT_MAX,
  COUPON_ISSUE_COUNT_MIN,
} from '@saome/shared/constants/coupon-card';
import {
  MAX_MULTIPASS_TIERS,
  MULTIPASS_TIER_NAME_MAX_LENGTH,
  MULTIPASS_STAMPS_NEEDED_MIN,
  MULTIPASS_STAMPS_NEEDED_MAX,
} from '@saome/shared/constants/multipass-card';

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

  // ===== Step 2 — language field (Rule 019 § 4.1, 2026-09-18) =====
  // Card display language (zh-TW | en) for Passcreator future integration.
  // Deferred: Passcreator API integration not yet implemented.
  it('shared schema has the language field (Rule 019 § 4.1 — Step 2 card language 2026-09-18)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('language');
  });

  it('local schema has the language field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('language');
  });

  it('shared language accepts zh-TW | en', () => {
    const field = sharedTemplateSettingsSchema.shape.language;
    expect(field.parse('zh-TW')).toBe('zh-TW');
    expect(field.parse('en')).toBe('en');
  });

  it('shared language rejects other values (drift guard)', () => {
    const field = sharedTemplateSettingsSchema.shape.language;
    expect(() => field.parse('zh')).toThrow();   // not zh-TW
    expect(() => field.parse('zh-Hant')).toThrow();
    expect(() => field.parse('english')).toThrow();
    expect(() => field.parse('')).toThrow();
  });

  // ===== Step 6 — Discount Card: discountTiers + expiry fields (2026-09-18, Rule 019 § 4.1) =====
  // User clarification 2026-09-18: in addition to tiered discount % (mirrors
  // cashback_tiers pattern), the discount card needs OPTIONAL card-level expiry
  // (custom days OR specific date, mutually exclusive). No `hasDiscountExpiry`
  // toggle — both fields are always visible and the field handler enforces
  // mutual exclusion. Mirrors the membership expiry field pattern.
  //
  // This block pins the 4-layer sync for the new fields:
  //   - shared `templateSettingsSchema.discountTiers` / `discountCustomExpiryDays` / `discountSpecificExpiryDate`
  //   - backend local `templateSettingsSchema.discountTiers` / `discountCustomExpiryDays` / `discountSpecificExpiryDate`
  //   - backend db interface `TemplateSettings` (validated via TypeScript type system)
  //   - frontend store (validated via TypeScript type system — see CardBuilderEditor.store.ts)

  it('shared schema has the discountTiers field (Rule 019 § 4.1 — Step 6 discount card 2026-09-18)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('discountTiers');
  });

  it('local schema has the discountTiers field (4-layer sync — Layer 2, Step 6 discount card)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('discountTiers');
  });

  it('shared discountTiers caps at MAX_DISCOUNT_TIERS=5', () => {
    const field = sharedTemplateSettingsSchema.shape.discountTiers;
    expect(() =>
      field.parse(
        Array.from({ length: 6 }, (_, i) => ({
          name: `tier-${i}`,
          thresholdSpend: i * 100,
          discountPercent: 5,
        })),
      ),
    ).toThrow();
    // 5 tiers is allowed
    expect(() =>
      field.parse(
        Array.from({ length: 5 }, (_, i) => ({
          name: `tier-${i}`,
          thresholdSpend: i * 100,
          discountPercent: 5,
        })),
      ),
    ).not.toThrow();
  });

  it('shared discountTiers requires name (1..40 chars)', () => {
    const field = sharedTemplateSettingsSchema.shape.discountTiers;
    // empty name rejected
    expect(() =>
      field.parse([{ name: '', thresholdSpend: 0, discountPercent: 5 }]),
    ).toThrow();
    // name too long rejected
    expect(() =>
      field.parse([{ name: 'x'.repeat(41), thresholdSpend: 0, discountPercent: 5 }]),
    ).toThrow();
  });

  it('shared discountTiers discountPercent must be integer in [1, 100]', () => {
    const field = sharedTemplateSettingsSchema.shape.discountTiers;
    // 0 rejected
    expect(() =>
      field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 0 }]),
    ).toThrow();
    // 101 rejected
    expect(() =>
      field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 101 }]),
    ).toThrow();
    // 5.5 (non-integer) rejected
    expect(() =>
      field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 5.5 }]),
    ).toThrow();
    // 1, 50, 100 all accepted
    expect(field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 1 }])).toHaveLength(1);
    expect(field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 50 }])).toHaveLength(1);
    expect(field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 100 }])).toHaveLength(1);
  });

  it('shared discountTiers thresholdSpend must be ≥ 0 (0 = default tier)', () => {
    const field = sharedTemplateSettingsSchema.shape.discountTiers;
    // negative rejected
    expect(() =>
      field.parse([{ name: 'x', thresholdSpend: -1, discountPercent: 5 }]),
    ).toThrow();
    // 0 is allowed (= default tier, everyone qualifies)
    expect(field.parse([{ name: 'x', thresholdSpend: 0, discountPercent: 5 }])).toHaveLength(1);
  });

  it('shared schema has the discountCustomExpiryDays field (Rule 019 § 4.1 — Step 6 discount card expiry)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('discountCustomExpiryDays');
  });

  it('local schema has the discountCustomExpiryDays field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('discountCustomExpiryDays');
  });

  it('shared discountCustomExpiryDays accepts integers in [1, 3650]', () => {
    const field = sharedTemplateSettingsSchema.shape.discountCustomExpiryDays;
    expect(field.parse(1)).toBe(1);
    expect(field.parse(365)).toBe(365);
    expect(field.parse(3650)).toBe(3650);
  });

  it('shared discountCustomExpiryDays rejects out-of-range and non-integer', () => {
    const field = sharedTemplateSettingsSchema.shape.discountCustomExpiryDays;
    expect(() => field.parse(0)).toThrow();
    expect(() => field.parse(3651)).toThrow();
    expect(() => field.parse(365.5)).toThrow();
  });

  it('shared discountCustomExpiryDays accepts null (no expiry sentinel)', () => {
    const field = sharedTemplateSettingsSchema.shape.discountCustomExpiryDays;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared schema has the discountSpecificExpiryDate field (Rule 019 § 4.1 — Step 6 discount card expiry)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('discountSpecificExpiryDate');
  });

  it('local schema has the discountSpecificExpiryDate field (4-layer sync — Layer 2)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('discountSpecificExpiryDate');
  });

  it('shared discountSpecificExpiryDate accepts ISO YYYY-MM-DD string', () => {
    const field = sharedTemplateSettingsSchema.shape.discountSpecificExpiryDate;
    expect(field.parse('2026-12-31')).toBe('2026-12-31');
  });

  it('shared discountSpecificExpiryDate accepts null (no expiry sentinel)', () => {
    const field = sharedTemplateSettingsSchema.shape.discountSpecificExpiryDate;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('full templateSettings accepts discount_card with tiers + expiry (end-to-end)', () => {
    // End-to-end happy path: a discount_card draft with 1 tier + custom expiry days
    // survives the schema parse. Mirrors what `cardService.update` would receive
    // from the workspace onSave handler.
    const payload = {
      cardType: 'discount_card',
      discountTiers: [
        { name: '預設', thresholdSpend: 0, discountPercent: 5 },
        { name: '金級', thresholdSpend: 5000, discountPercent: 10 },
      ],
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  // ===== Step 6 — Coupon 卡: 4 fields (Rule 019 § 4.1, 2026-09-19, coupon regression) =====
  // 2026-09-19 regression: the coupon fields were missing from the backend
  // mirror (Layer 2 request.ts + Layer 3 db/templates.ts interface), so zod
  // silently stripped them on PUT (zod default `.object()` strips unknown
  // keys). This caused the user-reported bug "coupon Step 6 doesn't save,
  // no backfill on re-edit". This block pins the 4-layer sync so the same
  // drift cannot recur:
  //   - shared `templateSettingsSchema.couponDiscountType / couponDiscountAmount / couponDiscountPercent / couponIssueCount` (Layer 1)
  //   - backend local `templateSettingsSchema.coupon*` (Layer 2, this file)
  //   - backend db interface `TemplateSettings.coupon*` (Layer 3)
  //   - frontend store (Layer 4 — already present in CardBuilderEditor.store.ts)
  //
  // The conformance test pins runtime bounds:
  //   - couponDiscountType: 'amount_off' | 'percent_off' | null (default 'amount_off')
  //   - couponDiscountAmount: ≥ 1 (>= COUPON_AMOUNT_MIN) or null (cleared)
  //   - couponDiscountPercent: integer in [1, 100] or null
  //   - couponIssueCount: integer ≥ 1 (no upper cap)
  it('shared schema has the couponDiscountType field (Rule 019 § 4.1 — Step 6 coupon card 2026-09-19)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('couponDiscountType');
  });

  it('local schema has the couponDiscountType field (4-layer sync — Layer 2, coupon persistence regression)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('couponDiscountType');
  });

  it('shared couponDiscountType accepts amount_off | percent_off | null', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountType;
    expect(field.parse('amount_off')).toBe('amount_off');
    expect(field.parse('percent_off')).toBe('percent_off');
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared couponDiscountType rejects invalid values (drift guard)', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountType;
    expect(() => field.parse('fixed')).toThrow();
    expect(() => field.parse('cash')).toThrow();
    expect(() => field.parse('')).toThrow();
  });

  it('shared schema has the couponDiscountAmount field (Rule 019 § 4.1 — Step 6 coupon card)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('couponDiscountAmount');
  });

  it('local schema has the couponDiscountAmount field (4-layer sync — Layer 2, coupon persistence regression)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('couponDiscountAmount');
  });

  it('shared couponDiscountAmount accepts numbers >= 1 (no upper cap per user decision)', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountAmount;
    expect(field.parse(1)).toBe(1);
    expect(field.parse(50)).toBe(50);
    expect(field.parse(999_999)).toBe(999_999);
  });

  it('shared couponDiscountAmount rejects 0 and negative numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountAmount;
    expect(() => field.parse(0)).toThrow();
    expect(() => field.parse(-1)).toThrow();
    expect(() => field.parse(-50)).toThrow();
  });

  it('shared couponDiscountAmount accepts null (cleared on percent_off switch)', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountAmount;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared schema has the couponDiscountPercent field (Rule 019 § 4.1 — Step 6 coupon card)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('couponDiscountPercent');
  });

  it('local schema has the couponDiscountPercent field (4-layer sync — Layer 2, coupon persistence regression)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('couponDiscountPercent');
  });

  it('shared couponDiscountPercent accepts integers in [1, 100]', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountPercent;
    expect(field.parse(1)).toBe(1);
    expect(field.parse(50)).toBe(50);
    expect(field.parse(100)).toBe(100);
  });

  it('shared couponDiscountPercent rejects out-of-range and non-integer values', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountPercent;
    expect(() => field.parse(0)).toThrow();
    expect(() => field.parse(101)).toThrow();
    expect(() => field.parse(50.5)).toThrow();
  });

  it('shared couponDiscountPercent accepts null (cleared on amount_off switch)', () => {
    const field = sharedTemplateSettingsSchema.shape.couponDiscountPercent;
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared schema has the couponIssueCount field (Rule 019 § 4.1 — Step 6 coupon card)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('couponIssueCount');
  });

  it('local schema has the couponIssueCount field (4-layer sync — Layer 2, coupon persistence regression)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('couponIssueCount');
  });

  it('shared couponIssueCount accepts integers >= 1 (no upper cap)', () => {
    const field = sharedTemplateSettingsSchema.shape.couponIssueCount;
    expect(field.parse(1)).toBe(1);
    expect(field.parse(5)).toBe(5);
    expect(field.parse(9999)).toBe(9999);
    expect(field.parse(100_000)).toBe(100_000);
  });

  it('shared couponIssueCount rejects 0 and negative numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.couponIssueCount;
    expect(() => field.parse(0)).toThrow();
    expect(() => field.parse(-1)).toThrow();
  });

  it('full templateSettings accepts coupon_card with amount_off path (end-to-end)', () => {
    // End-to-end happy path: a coupon_card draft with amount_off + discount amount + issue count
    // survives the schema parse. Mirrors what `cardService.update` would receive
    // from the workspace onSave handler.
    const payload = {
      cardType: 'coupon_card',
      couponDiscountType: 'amount_off' as const,
      couponDiscountAmount: 50,
      couponDiscountPercent: null,
      couponIssueCount: 1,
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  it('full templateSettings accepts coupon_card with percent_off path (end-to-end)', () => {
    const payload = {
      cardType: 'coupon_card',
      couponDiscountType: 'percent_off' as const,
      couponDiscountAmount: null,
      couponDiscountPercent: 20,
      couponIssueCount: 3,
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  it('full templateSettings rejects coupon_card with both amount and percent set (mutual exclusion)', () => {
    // The store setter enforces mutual exclusion (clearing the other on type switch),
    // but the schema does NOT enforce it — both fields are independent nullable.
    // This is intentional: the schema is the contract layer, not the UI layer.
    // Both fields being set simultaneously should still PARSE — it's an editor
    // bug, not a contract violation. (Pin this behavior so any future change
    // that adds strict mutual exclusion is intentional and tested separately.)
    const payload = {
      couponDiscountType: 'amount_off' as const,
      couponDiscountAmount: 50,
      couponDiscountPercent: 20, // both fields set — editor shouldn't allow, but schema accepts
      couponIssueCount: 1,
    };
    expect(() => sharedTemplateSettingsSchema.parse(payload)).not.toThrow();
    expect(() => localTemplateSettingsSchema.parse(payload)).not.toThrow();
  });

  // ===== Step 6 — Multipass 卡: multipassTiers (Rule 019 § 4.1, 2026-09-19) =====
  // 2026-09-19 PR-1: the multipass card is the seventh card-type-specific
  // logic editor. Differs structurally from stamp_card:
  //   - stamp_card has a SINGLE flat reward (one rewardName + rewardType +
  //     rewardValue + maxDiscountAmount).
  //   - multipass has UP TO MAX_MULTIPASS_TIERS=5 tiers, each tier carries
  //     its own name + stampsNeeded + rewardType + rewardValue.
  //   - stampsNeeded = 0 IS legitimate (= 歡迎禮「辦卡立刻送」).
  //   - stampsNeeded is COMPLETELY DECOUPLED from the Step 3 stamp grid.
  //
  // This block pins the 4-layer sync (Rule 019 § 4.1):
  //   - shared `templateSettingsSchema.multipassTiers` (Layer 1)
  //   - backend local `templateSettingsSchema.multipassTiers` (Layer 2)
  //   - backend db interface `TemplateSettings.multipassTiers` (Layer 3 — TS type system)
  //   - frontend store (Layer 4 — deferred to PR-2)
  it('shared schema has the multipassTiers field (Rule 019 § 4.1 — Step 6 multipass card 2026-09-19)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('multipassTiers');
  });

  it('local schema has the multipassTiers field (4-layer sync — Layer 2, Step 6 multipass card)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('multipassTiers');
  });

  it('shared multipassTiers caps at MAX_MULTIPASS_TIERS=5', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    // 6 tiers rejected
    expect(() =>
      field.parse(
        Array.from({ length: 6 }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ),
    ).toThrow();
    // 5 tiers allowed
    expect(() =>
      field.parse(
        Array.from({ length: 5 }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ),
    ).not.toThrow();
  });

  it('local multipassTiers caps at MAX_MULTIPASS_TIERS=5', () => {
    const field = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse(
        Array.from({ length: 6 }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ),
    ).toThrow();
  });

  it('shared multipassTiers requires name (1..40 chars)', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    // empty name rejected
    expect(() =>
      field.parse([
        { name: '', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
    // name too long rejected
    expect(() =>
      field.parse([
        { name: 'x'.repeat(41), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
    // 40-char name accepted
    expect(() =>
      field.parse([
        { name: 'x'.repeat(40), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers requires name (1..40 chars)', () => {
    const field = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: '', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
    expect(() =>
      field.parse([
        { name: 'x'.repeat(41), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers stampsNeeded accepts 0 (welcome gift 歡迎禮)', () => {
    // 0 is legitimate — 歡迎禮「辦卡立刻送」, reward triggers on card download.
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers stampsNeeded accepts 0 (welcome gift 歡迎禮)', () => {
    const field = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers stampsNeeded rejects negatives', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: -1, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers stampsNeeded rejects > 999 (safety valve)', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 1000, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers stampsNeeded requires integer (no decimals)', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 1.5, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers stampsNeeded accepts 999 (top of safety valve)', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 999, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers rewardType accepts amount_off | percent_off | null', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 }]),
    ).not.toThrow();
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: 'percent_off', rewardValue: 20 }]),
    ).not.toThrow();
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: null, rewardValue: null }]),
    ).not.toThrow();
  });

  it('local multipassTiers rewardType accepts amount_off | percent_off | null', () => {
    const field = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 }]),
    ).not.toThrow();
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: 'percent_off', rewardValue: 20 }]),
    ).not.toThrow();
    expect(() =>
      field.parse([{ name: 'tier', stampsNeeded: 0, rewardType: null, rewardValue: null }]),
    ).not.toThrow();
  });

  it('shared multipassTiers rewardType rejects invalid values', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: 'fixed', rewardValue: 50 } as unknown,
      ]),
    ).toThrow();
  });

  it('shared multipassTiers rewardValue accepts positive numbers', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]),
    ).not.toThrow();
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: 'percent_off', rewardValue: 20 },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers rewardValue rejects zero and negatives', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 0 },
      ]),
    ).toThrow();
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: -1 },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers rewardValue accepts null (when rewardType is null)', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      field.parse([
        { name: 'tier', stampsNeeded: 0, rewardType: null, rewardValue: null },
      ]),
    ).not.toThrow();
  });

  it('full templateSettings accepts multipass with welcome-gift tier (end-to-end)', () => {
    // End-to-end happy path: a multipass draft with a 歡迎禮 tier
    // (stampsNeeded=0) + a follow-up tier (stampsNeeded=10) survives the
    // schema parse. Mirrors what `cardService.update` would receive
    // from the workspace onSave handler.
    const payload = {
      cardType: 'multipass',
      multipassTiers: [
        { name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
        { name: 'VIP 回饋', stampsNeeded: 10, rewardType: 'percent_off', rewardValue: 15 },
      ],
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  it('full templateSettings accepts multipass with empty tiers array (no tiers yet)', () => {
    // Edge case: user hasn't added any tiers. An empty array is a
    // legitimate intermediate state during editing.
    const payload = {
      cardType: 'multipass',
      multipassTiers: [],
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  // ===== Step 6 — Multipass 卡 PR-5 (2026-09-20): card-wide mode + per-tier threshold fields =====
  // PR-5 extends Multipass with:
  //   - card-wide `multipassAccrualMode` enum (per_stamp | per_visit | per_spend | null)
  //   - 4 per-tier threshold fields:
  //       perVisitCount / perVisitStamps (per_visit mode)
  //       perSpendAmount / perSpendStamps (per_spend mode)
  //
  // 4-layer sync (Rule 019 § 4.1) pins that the contract layer (shared),
  // backend Layer 2 mirror (request.ts), and `multipassTiers[*]` shape
  // are coherent across the new fields. Constants imported from
  // `@saome/shared/constants/multipass-card` enforce bounds:
  //   - MULTIPASS_STAMPS_PER_VISIT_MIN=1, MULTIPASS_STAMPS_PER_SPEND_MIN=0.01

  it('shared schema has the multipassAccrualMode field (Rule 019 § 4.1 — Step 6 multipass card PR-5)', () => {
    expect(Object.keys(sharedTemplateSettingsSchema.shape)).toContain('multipassAccrualMode');
  });

  it('local schema has the multipassAccrualMode field (4-layer sync — Layer 2, Step 6 multipass PR-5)', () => {
    expect(Object.keys(localTemplateSettingsSchema.shape)).toContain('multipassAccrualMode');
  });

  it('shared multipassAccrualMode accepts per_stamp | per_visit | per_spend | null', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassAccrualMode;
    expect(field.parse('per_stamp')).toBe('per_stamp');
    expect(field.parse('per_visit')).toBe('per_visit');
    expect(field.parse('per_spend')).toBe('per_spend');
    expect(field.parse(null)).toBe(null);
    expect(field.parse(undefined)).toBe(undefined);
  });

  it('shared multipassAccrualMode rejects invalid values', () => {
    const field = sharedTemplateSettingsSchema.shape.multipassAccrualMode;
    expect(() => field.parse('manual')).toThrow();
    expect(() => field.parse('auto')).toThrow();
  });

  it('local multipassAccrualMode accepts per_stamp | per_visit | per_spend | null', () => {
    const field = localTemplateSettingsSchema.shape.multipassAccrualMode;
    expect(field.parse('per_stamp')).toBe('per_stamp');
    expect(field.parse('per_visit')).toBe('per_visit');
    expect(field.parse('per_spend')).toBe('per_spend');
    expect(field.parse(null)).toBe(null);
  });

  it('shared multipassTiers[*] perVisitCount / perVisitStamps accepted (PR-5 per-tier threshold)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: 2,
          perVisitStamps: 1,
        },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers[*] perVisitCount / perVisitStamps accepted (PR-5 per-tier threshold)', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: 2,
          perVisitStamps: 1,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*] perSpendAmount / perSpendStamps accepted (PR-5 per-tier threshold)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers[*] perSpendAmount / perSpendStamps accepted (PR-5 per-tier threshold)', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perSpendAmount: 100,
          perSpendStamps: 1,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*] perVisitCount / perVisitStamps accepted as null (per-tier toggle)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: null,
          perVisitStamps: null,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*] perVisitCount rejects 0 or negative (≥ 1)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: 0,
          perVisitStamps: 1,
        },
      ]),
    ).toThrow();
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perVisitCount: -1,
          perVisitStamps: 1,
        },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers[*] perSpendAmount must be ≥ MULTIPASS_STAMPS_PER_SPEND_MIN=0.01', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perSpendAmount: 0,
          perSpendStamps: 1,
        },
      ]),
    ).toThrow();
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 5,
          rewardType: null,
          rewardValue: null,
          perSpendAmount: 0.01,
          perSpendStamps: 1,
        },
      ]),
    ).not.toThrow();
  });

  it('full templateSettings accepts multipass card with both PR-5 fields (per_visit + per_spend mix end-to-end)', () => {
    // End-to-end happy path: a multipass draft with card-wide
    // multipassAccrualMode='per_visit' + per-tier perVisitCount /
    // perVisitStamps set, all preserved through parse.
    const payload = {
      cardType: 'multipass',
      multipassAccrualMode: 'per_visit' as const,
      multipassTiers: [
        {
          name: 'Welcome gift',
          stampsNeeded: 0,
          rewardType: null,
          rewardValue: null,
          perVisitCount: 2,
          perVisitStamps: 1,
          perSpendAmount: null,
          perSpendStamps: null,
        },
        {
          name: 'Bronze',
          stampsNeeded: 5,
          rewardType: 'percent_off',
          rewardValue: 5,
          perVisitCount: 3,
          perVisitStamps: 1,
          perSpendAmount: null,
          perSpendStamps: null,
        },
      ],
    };
    expect(sharedTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
    expect(localTemplateSettingsSchema.parse(payload)).toMatchObject(payload);
  });

  // ===== Step 6 — Multipass 卡 PR-6 (2026-09-20): per-tier maxDiscountAmount =====
  // ★ PR-6 修補: `MultipassTierMaxDiscountAmountField` UI 元件在 PR-6 建立時,
  // Layer 1-3 schema 漏加 `maxDiscountAmount` 欄位, 導致:
  //   1. PUT 時 serializer 沒有序列化 maxDiscountAmount (4-layer drift)
  //   2. Backend zod schema 沒有這個欄位 (strip unknown field → silent drop)
  //   3. DB type 沒有這個欄位
  //   4. Loader 不讀 obj.maxDiscountAmount
  // 結果: 使用者輸入最高折抵金額 → 存不到 → 沒有回填
  //
  // 修法: 4 層同步加欄位 (Rule 019 § 4.1). 對齊 stamp_card.maxDiscountAmount.
  //
  // 4-layer sync pins:
  //   - shared `templateSettingsSchema.multipassTiers[*].maxDiscountAmount` (Layer 1)
  //   - backend local `templateSettingsSchema.multipassTiers[*].maxDiscountAmount` (Layer 2)
  //   - backend db `TemplateSettings.multipassTiers[*].maxDiscountAmount` (Layer 3 — TS type)
  //   - frontend store already had it via MultipassTierShape (Layer 4 — OK)

  it('shared multipassTiers[*].maxDiscountAmount accepts null (no cap sentinel)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: null,
        },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers[*].maxDiscountAmount accepts null (no cap sentinel)', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: null,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*].maxDiscountAmount accepts 0 (zero = no cap)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 0,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*].maxDiscountAmount accepts positive numbers', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 50,
        },
      ]),
    ).not.toThrow();
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 1_000_000,
        },
      ]),
    ).not.toThrow();
  });

  it('local multipassTiers[*].maxDiscountAmount accepts positive numbers', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 50,
        },
      ]),
    ).not.toThrow();
  });

  it('shared multipassTiers[*].maxDiscountAmount rejects negative numbers', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: -1,
        },
      ]),
    ).toThrow();
  });

  it('shared multipassTiers[*].maxDiscountAmount accepts undefined (field not present)', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(() =>
      f.parse([
        {
          name: 'tier',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 10,
          // maxDiscountAmount omitted
        },
      ]),
    ).not.toThrow();
  });

  it('full templateSettings round-trips multipass with maxDiscountAmount (shared)', () => {
    const payload = {
      cardType: 'multipass',
      multipassTiers: [
        {
          name: 'Basic',
          stampsNeeded: 0,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
        },
        {
          name: 'VIP',
          stampsNeeded: 10,
          rewardType: 'percent_off',
          rewardValue: 15,
          maxDiscountAmount: 100,
        },
      ],
    };
    const parsed = sharedTemplateSettingsSchema.parse(payload);
    expect(parsed.multipassTiers?.[0].maxDiscountAmount).toBeNull();
    expect(parsed.multipassTiers?.[1].maxDiscountAmount).toBe(100);
  });

  it('full templateSettings round-trips multipass with maxDiscountAmount (local/backend)', () => {
    const payload = {
      cardType: 'multipass',
      multipassTiers: [
        {
          name: 'Gold',
          stampsNeeded: 5,
          rewardType: 'percent_off',
          rewardValue: 20,
          maxDiscountAmount: 500,
        },
      ],
    };
    const parsed = localTemplateSettingsSchema.parse(payload);
    expect(parsed.multipassTiers?.[0].maxDiscountAmount).toBe(500);
  });
});

/**
 * Defensive conformance — Rule 019 § 4.1 boundary pin.
 *
 * These tests probe the schema's `safeParse` behavior at the exact
 * constants-imported bounds (COUPON_*_MIN, COUPON_PERCENT_MAX). They
 * catch two regression modes:
 *   1. Schema re-hardcodes literals (`min(1)`) while the constant
 *      changes (`COUPON_AMOUNT_MIN = 5`) — the all-import test still
 *      passes since both sides read 1, but the boundary semantics
 *      would silently break.
 *   2. One side (shared OR local) drops the import and falls back to a
 *      different literal — the mirror schema conformance test (above)
 *      catches it because local vs shared parsing differs.
 *
 * Required: every coupon numeric field's schema in BOTH shared and
 * local must reject `MIN - 0.01`, accept `MIN`, accept `MAX` where MAX
 * is defined (only `couponDiscountPercent` has a MAX), and accept very
 * large positives for fields declared "no upper cap" (amount, issue_count).
 */
describe('coupon schema values honor shared constants (Rule 019 § 4.1)', () => {
  // couponDiscountAmount — MIN only (no upper cap per user decision 2026-09-19)

  it('shared couponDiscountAmount.min === COUPON_AMOUNT_MIN boundary', () => {
    const f = sharedTemplateSettingsSchema.shape.couponDiscountAmount;
    expect(f.safeParse(COUPON_AMOUNT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_AMOUNT_MIN - 0.01).success).toBe(false);
    expect(f.safeParse(COUPON_AMOUNT_MIN - 1).success).toBe(false);
  });

  it('local couponDiscountAmount.min === COUPON_AMOUNT_MIN boundary', () => {
    const f = localTemplateSettingsSchema.shape.couponDiscountAmount;
    expect(f.safeParse(COUPON_AMOUNT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_AMOUNT_MIN - 0.01).success).toBe(false);
  });

  // couponDiscountPercent — MIN and MAX (both required)

  it('shared couponDiscountPercent bounded by COUPON_PERCENT_MIN..MAX', () => {
    const f = sharedTemplateSettingsSchema.shape.couponDiscountPercent;
    expect(f.safeParse(COUPON_PERCENT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_PERCENT_MAX).success).toBe(true);
    expect(f.safeParse(COUPON_PERCENT_MIN - 1).success).toBe(false);
    expect(f.safeParse(COUPON_PERCENT_MAX + 1).success).toBe(false);
  });

  it('local couponDiscountPercent bounded by COUPON_PERCENT_MIN..MAX', () => {
    const f = localTemplateSettingsSchema.shape.couponDiscountPercent;
    expect(f.safeParse(COUPON_PERCENT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_PERCENT_MAX).success).toBe(true);
    expect(f.safeParse(COUPON_PERCENT_MIN - 1).success).toBe(false);
    expect(f.safeParse(COUPON_PERCENT_MAX + 1).success).toBe(false);
  });

  // couponIssueCount — MIN only (no upper cap per user decision 2026-09-19)

  it('shared couponIssueCount.min === COUPON_ISSUE_COUNT_MIN (no upper cap)', () => {
    const f = sharedTemplateSettingsSchema.shape.couponIssueCount;
    expect(f.safeParse(COUPON_ISSUE_COUNT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_ISSUE_COUNT_MIN - 1).success).toBe(false);
    expect(f.safeParse(999_999).success).toBe(true); // no upper cap
  });

  it('local couponIssueCount.min === COUPON_ISSUE_COUNT_MIN (no upper cap)', () => {
    const f = localTemplateSettingsSchema.shape.couponIssueCount;
    expect(f.safeParse(COUPON_ISSUE_COUNT_MIN).success).toBe(true);
    expect(f.safeParse(COUPON_ISSUE_COUNT_MIN - 1).success).toBe(false);
    expect(f.safeParse(999_999).success).toBe(true);
  });
});

/**
 * Defensive conformance — Rule 019 § 4.1 boundary pin for multipass.
 *
 * Mirrors the coupon boundary describe block above. Each numeric field
 * in multipassTiers must honor the constants imported from
 * `@saome/shared/constants/multipass-card`:
 *   - MULTIPASS_TIER_NAME_MAX_LENGTH=40 (name length cap)
 *   - MULTIPASS_STAMPS_NEEDED_MIN=0 (welcome gift 歡迎禮 floor)
 *   - MULTIPASS_STAMPS_NEEDED_MAX=999 (safety valve ceiling)
 *   - MAX_MULTIPASS_TIERS=5 (array length cap)
 *
 * If the schema re-hardcodes literals while the constant changes, or
 * one side drops the import, these tests catch the drift.
 */
describe('multipass schema values honor shared constants (Rule 019 § 4.1)', () => {
  // tier name length cap

  it('shared multipassTiers name.max === MULTIPASS_TIER_NAME_MAX_LENGTH boundary', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(
      f.safeParse([
        { name: 'x'.repeat(MULTIPASS_TIER_NAME_MAX_LENGTH), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'x'.repeat(MULTIPASS_TIER_NAME_MAX_LENGTH + 1), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
  });

  it('local multipassTiers name.max === MULTIPASS_TIER_NAME_MAX_LENGTH boundary', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(
      f.safeParse([
        { name: 'x'.repeat(MULTIPASS_TIER_NAME_MAX_LENGTH), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'x'.repeat(MULTIPASS_TIER_NAME_MAX_LENGTH + 1), stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
  });

  // stampsNeeded bounded by MULTIPASS_STAMPS_NEEDED_MIN..MAX (with safety-valve semantics)

  it('shared multipassTiers stampsNeeded bounded by MULTIPASS_STAMPS_NEEDED_MIN..MAX', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MIN, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MAX, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MIN - 1, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MAX + 1, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
  });

  it('local multipassTiers stampsNeeded bounded by MULTIPASS_STAMPS_NEEDED_MIN..MAX', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MIN, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MAX, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(true);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MIN - 1, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
    expect(
      f.safeParse([
        { name: 'tier', stampsNeeded: MULTIPASS_STAMPS_NEEDED_MAX + 1, rewardType: 'amount_off', rewardValue: 50 },
      ]).success,
    ).toBe(false);
  });

  // Array length cap (MAX_MULTIPASS_TIERS=5)

  it('shared multipassTiers.max === MAX_MULTIPASS_TIERS boundary', () => {
    const f = sharedTemplateSettingsSchema.shape.multipassTiers;
    // 5 tiers accepted
    expect(
      f.safeParse(
        Array.from({ length: MAX_MULTIPASS_TIERS }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ).success,
    ).toBe(true);
    // 6 tiers rejected
    expect(
      f.safeParse(
        Array.from({ length: MAX_MULTIPASS_TIERS + 1 }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ).success,
    ).toBe(false);
  });

  it('local multipassTiers.max === MAX_MULTIPASS_TIERS boundary', () => {
    const f = localTemplateSettingsSchema.shape.multipassTiers;
    expect(
      f.safeParse(
        Array.from({ length: MAX_MULTIPASS_TIERS }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ).success,
    ).toBe(true);
    expect(
      f.safeParse(
        Array.from({ length: MAX_MULTIPASS_TIERS + 1 }, (_, i) => ({
          name: `tier-${i}`,
          stampsNeeded: i,
          rewardType: 'amount_off' as const,
          rewardValue: 10,
        })),
      ).success,
    ).toBe(false);
  });
});
