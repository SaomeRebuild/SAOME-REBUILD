/**
 * CARD_FIELDS — schema conformance tests.
 *
 * @module shared/constants/card-fields.test
 *
 * v12 (2026-10-12): pin that every entry in `CARD_FIELDS` carries a
 * valid `semanticType`. The TypeScript type system already enforces
 * this at compile time (`semanticType: FieldSemanticType` is required
 * on `CardFieldDefinition`); this test is a runtime safety net for
 * cases where the file is read by JS-only tooling or imported via a
 * path that bypasses TS narrowing.
 *
 * Why this matters:
 *   - `mapFieldType()` in `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`
 *     reads `CARD_FIELDS[i].semanticType` to build Passcreator V2
 *     `fields[].type` values. If any entry is missing the field, the
 *     built pass silently degrades to 'text', breaking numeric /
 *     date rendering on the deployed wallet pass.
 *   - Before v12, `mapFieldType` was a 19-case hard-coded switch that
 *     drifted from `CARD_FIELDS` membership (see v11 feedback § 教訓 4).
 *     The data-driven refactor flips the dependency: source of truth
 *     is now `CARD_FIELDS`, and `mapFieldType` is a pure projection.
 *     This test guards the source of truth.
 *
 * Rule references:
 *   - Rule 019 § 4.1 — schema is the source of truth.
 *   - Rule 003 — TDD: this test pins the new required field.
 */

import { describe, it, expect } from 'vitest';
import {
  CARD_FIELDS,
  CARD_FIELD_KEYS,
  TYPE_DOWNGRADED_TEXT_FIELDS,
  type FieldSemanticType,
} from './card-fields';

const VALID_SEMANTIC_TYPES: ReadonlySet<FieldSemanticType> = new Set([
  'text',
  'number',
  'date',
]);

describe('CARD_FIELDS — v12 schema conformance (regression — 2026-10-12)', () => {
  it('every entry carries a `semanticType` field (required by v12)', () => {
    expect(CARD_FIELDS.length).toBeGreaterThan(0);
    for (const field of CARD_FIELDS) {
      expect(
        field,
        `CARD_FIELDS entry for key=${field.key} is missing semanticType`,
      ).toHaveProperty('semanticType');
      expect(
        typeof field.semanticType,
        `CARD_FIELDS[${field.key}].semanticType is not a string`,
      ).toBe('string');
    }
  });

  it('every `semanticType` value is one of {text, number, date}', () => {
    for (const field of CARD_FIELDS) {
      expect(
        VALID_SEMANTIC_TYPES.has(field.semanticType),
        `CARD_FIELDS[${field.key}].semanticType="${field.semanticType}" is not a valid FieldSemanticType`,
      ).toBe(true);
    }
  });

  it('CARD_FIELDS.key set === CARD_FIELD_KEYS (no orphan entries either direction)', () => {
    const cardFieldsKeys = new Set(CARD_FIELDS.map((f) => f.key));
    const cardFieldKeys = new Set(CARD_FIELD_KEYS);

    for (const k of cardFieldKeys) {
      expect(
        cardFieldsKeys.has(k),
        `CARD_FIELD_KEYS contains "${k}" but CARD_FIELDS does not have a matching entry`,
      ).toBe(true);
    }
    for (const k of cardFieldsKeys) {
      expect(
        cardFieldKeys.has(k),
        `CARD_FIELDS contains "${k}" but CARD_FIELD_KEYS does not`,
      ).toBe(true);
    }
  });

  it('semanticType distribution — most fields are "number" (face slots are mostly counts / amounts)', () => {
    // This is a soft check — it documents the expected shape. If a
    // future contributor changes many entries to 'text', the ratio
    // would shift, but that's not necessarily wrong. The test is
    // here to catch a "mass change" accident, not a deliberate rewrite.
    const counts: Record<FieldSemanticType, number> = { text: 0, number: 0, date: 0 };
    for (const f of CARD_FIELDS) {
      counts[f.semanticType] += 1;
    }
    // 9 text: phone, email, memberLevel, memberName,
    //         multipassRewardContent,
    //         pointsToNextTierDiscount, discountTierBracket,
    //         accumulatedSpendDiscount, visitCount
    //   (the three discount slots were downgraded from 'number' to
    //    'text' on 2026-10-27 — their runtime values are display
    //    strings like `10元`, and a `number` slot rejects them.
    //    visitCount was downgraded the same day for the same reason:
    //    its value is `5 次` / `5 times`, not a bare integer.
    //    See packages/shared/constants/card-fields.ts for the full
    //    rationale.)
    // birthday = 1 date
    // 11 number (availableRewards, totalStamps, stampsRemaining,
    //            pointsToNextTier, currentPoints, pointsToNextTierCashback,
    //            accumulatedSpendCashback,
    //            couponRemainingCount, couponDiscount, multipassCompleted,
    //            multipassPointsToNextTier)
    expect(counts.text).toBe(9);
    expect(counts.number).toBe(11);
    expect(counts.date).toBe(1);
  });

  it('the three discount slots are typed "text" (their values carry a unit)', () => {
    // Regression guard for the 2026-10-27 downgrade. A `number` slot
    // makes Passcreator reject the "number + unit" display strings the
    // Wallet needs, and the rejection takes the whole payload down.
    const discountSlotKeys = [
      'pointsToNextTierDiscount',
      'discountTierBracket',
      'accumulatedSpendDiscount',
    ] as const;
    for (const key of discountSlotKeys) {
      const field = CARD_FIELDS.find((f) => f.key === key);
      expect(field?.semanticType, `${key} must be a text slot`).toBe('text');
    }
  });

  it('the visitCount slot is typed "text" (its value carries the 次 / times unit)', () => {
    // Regression guard for the 2026-10-27 downgrade. The Wallet shows
    // `5 次` / `5 times`, not a bare `5` — and a `number` slot makes
    // Passcreator reject the string with a 400 that takes the WHOLE
    // payload down (every other field stops syncing too).
    const field = CARD_FIELDS.find((f) => f.key === 'visitCount');
    expect(field?.semanticType, 'visitCount must be a text slot').toBe('text');
  });

  it('TYPE_DOWNGRADED_TEXT_FIELDS covers every text slot whose value carries a unit', () => {
    // The set drives the runtime 400 fallback (see
    // apps/backend/src/shared/lib/passcreator/v3-pass.ts). A field that
    // leaves the set while still sending a unit-carrying string would
    // 400 the whole payload with no fallback.
    const unitCarryingKeys = [
      'pointsToNextTierDiscount',
      'discountTierBracket',
      'accumulatedSpendDiscount',
      'visitCount',
    ] as const;
    for (const key of unitCarryingKeys) {
      expect(
        TYPE_DOWNGRADED_TEXT_FIELDS.has(key),
        `${key} must be in TYPE_DOWNGRADED_TEXT_FIELDS`,
      ).toBe(true);
    }
  });
});
