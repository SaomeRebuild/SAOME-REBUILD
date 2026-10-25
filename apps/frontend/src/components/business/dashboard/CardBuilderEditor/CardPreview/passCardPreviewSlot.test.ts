/**
 * passCardPreviewSlot — Vitest unit tests for the shared helpers
 * (`resolveSlot`, `deriveTemplateOverrides`, `resolveHeaderRightSlot`).
 *
 * 2026-10-05 PR — Adds `resolveHeaderRightSlot` conformance tests that
 * pin the 6-step branch order for the per-cardType header right slot:
 *   1. membership_card    → member expiry preview
 *   2. discount_card      → discount expiry preview
 *   3. coupon_card        → coupon expiry preview
 *   4. stamp_card / reward_card / cashback_card / multipass
 *                          → balance preview (currency-driven)
 *   5. gift_card          → gift points preview (hardcoded)
 *   6. null / undefined   → default pill (t('defaultCardType'))
 *
 * The helper is shared between `PassCardPreviewHeader.tsx` (editor-side
 * preview) and `TemplateCardPreview.tsx` (template-library preview). Tests
 * here are pure-function tests of the helper itself — integration tests
 * live with each consumer component.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveSlot,
  deriveTemplateOverrides,
  resolveHeaderRightSlot,
  formatExpiryDateForHeader,
  type PassCardSlotTranslator,
} from './passCardPreviewSlot';
import { BALANCE_PREVIEW_AMOUNTS } from '@saome/shared/constants/balancePreview';
import { GIFT_POINTS_PREVIEW_VALUE } from '@saome/shared/constants/gift-card';

// Translator that returns the key as text. Matches the `vi.mock('react-i18next')`
// pattern used in editor / library component tests, so assertions read against
// i18n keys directly.
const tKey: PassCardSlotTranslator = (key) => key;

// Translator that returns a fixed string for any key — useful for asserting
// against labels / values that are NOT key-derived (e.g. preview values).
const tConstant = (value: string): PassCardSlotTranslator => () => value;

describe('resolveHeaderRightSlot — branch order (regression — 2026-10-05)', () => {
  it('1. membership_card → member expiry preview (hasExpiry=false → "∞")', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: false,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.testId).toBe('member-expiry-preview');
      expect(slot.label).toBe('memberExpiry.label');
      expect(slot.value).toBe('∞');
    }
  });

  it('1. membership_card + hasExpiry=true + expiryDate="2027-10-23" → en format (10.23.2027)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: true,
      expiryDate: '2027-10-23',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('10.23.2027');
    }
  });

  it('1. membership_card + hasExpiry=true + zh-TW locale → zh-TW format (2027.10.23)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: true,
      expiryDate: '2027-10-23',
      currency: 'TWD',
      locale: 'zh-TW',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('2027.10.23');
    }
  });

  it('1. membership_card + hasExpiry=true + empty expiryDate → DEFAULT_EXPIRY_DATE fallback', () => {
    // Membership card intentionally hides step2's expiry fields by design,
    // so the helper falls back to the hardcoded DEFAULT_EXPIRY_DATE
    // ('2027-10-23') when hasExpiry=true but expiryDate is empty.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: true,
      expiryDate: '',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('10.23.2027');
    }
  });

  it('1. membership_card + hasExpiry=true + malformed expiryDate → return verbatim (defensive)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: true,
      expiryDate: 'not-a-date',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('not-a-date');
    }
  });

  it('2. discount_card + discountSpecificExpiryDate="2026-10-30" → formatted en', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-10-30',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.testId).toBe('discount-expiry-preview');
      expect(slot.label).toBe('discountExpiry.label');
      expect(slot.value).toBe('10.30.2026');
    }
  });

  it('2. discount_card + discountSpecificExpiryDate + zh-TW locale → zh-TW format', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-10-30',
      currency: 'TWD',
      locale: 'zh-TW',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('2026.10.30');
    }
  });

  it('2. discount_card + discountCustomExpiryDays=30 → today + 30 days (en)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      // Compute expected value the same way as the helper: today + 30 days
      // in en format (MM.DD.YYYY).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const future = new Date(today);
      future.setDate(future.getDate() + 30);
      const mm = String(future.getMonth() + 1).padStart(2, '0');
      const dd = String(future.getDate()).padStart(2, '0');
      const yyyy = future.getFullYear();
      const expected = `${mm}.${dd}.${yyyy}`;
      expect(slot.value).toBe(expected);
    }
  });

  it('2. discount_card + both discount fields null → "∞" fallback', () => {
    // Theoretical — Step 6 requires one. The helper renders "∞"
    // defensively, matching the runtime sentinel (2026-10-26).
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('∞');
    }
  });

  it('3. coupon_card + expiryDate="2026-10-30" → formatted en', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'coupon_card',
      passValidDays: null,
      expiryDate: '2026-10-30',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.testId).toBe('coupon-expiry-preview');
      expect(slot.label).toBe('couponExpiry.label');
      expect(slot.value).toBe('10.30.2026');
    }
  });

  it('3. coupon_card + passValidDays=7 → today + 7 days (en)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'coupon_card',
      passValidDays: 7,
      expiryDate: '',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const future = new Date(today);
      future.setDate(future.getDate() + 7);
      const mm = String(future.getMonth() + 1).padStart(2, '0');
      const dd = String(future.getDate()).padStart(2, '0');
      const yyyy = future.getFullYear();
      const expected = `${mm}.${dd}.${yyyy}`;
      expect(slot.value).toBe(expected);
    }
  });

  it('3. coupon_card + both passValidDays null AND expiryDate empty → "∞" infinity', () => {
    // Coupon default: no implied expiry. Falls back to "∞" mirroring
    // membership_card hasExpiry=false UX.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'coupon_card',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('∞');
    }
  });

  it.each(['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const)(
    '4. %s + currency=TWD → balance preview (TWD amount)',
    (cardType) => {
      const slot = resolveHeaderRightSlot(tKey, {
        cardType,
        currency: 'TWD',
        locale: 'en',
      });
      expect(slot.kind).toBe('preview');
      if (slot.kind === 'preview') {
        expect(slot.testId).toBe('balance-preview');
        expect(slot.label).toBe('balancePreview.label');
        expect(slot.value).toBe(BALANCE_PREVIEW_AMOUNTS.TWD);
      }
    },
  );

  it.each(['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const)(
    '4. %s + currency=ZAR → balance preview (ZAR amount)',
    (cardType) => {
      const slot = resolveHeaderRightSlot(tKey, {
        cardType,
        currency: 'ZAR',
        locale: 'en',
      });
      expect(slot.kind).toBe('preview');
      if (slot.kind === 'preview') {
        expect(slot.testId).toBe('balance-preview');
        expect(slot.label).toBe('balancePreview.label');
        expect(slot.value).toBe(BALANCE_PREVIEW_AMOUNTS.ZAR);
      }
    },
  );

  it('5. gift_card → gift points preview (hardcoded value)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'gift_card',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.testId).toBe('gift-points-preview');
      expect(slot.label).toBe('giftPointsPreview.label');
      expect(slot.value).toBe(GIFT_POINTS_PREVIEW_VALUE);
    }
  });

  it('5. gift_card → gift points preview is currency-invariant', () => {
    // Switching currency does NOT change the gift points preview value
    // (it's hardcoded per user decision 2026-09-27).
    const twdSlot = resolveHeaderRightSlot(tKey, {
      cardType: 'gift_card',
      currency: 'TWD',
      locale: 'en',
    });
    const zarSlot = resolveHeaderRightSlot(tKey, {
      cardType: 'gift_card',
      currency: 'ZAR',
      locale: 'en',
    });
    if (twdSlot.kind === 'preview' && zarSlot.kind === 'preview') {
      expect(twdSlot.value).toBe(zarSlot.value);
      expect(twdSlot.value).toBe(GIFT_POINTS_PREVIEW_VALUE);
    }
  });

  it('6. cardType=null → default pill', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('pill');
    if (slot.kind === 'pill') {
      expect(slot.label).toBe('defaultCardType');
    }
  });

  it('6. cardType=undefined → default pill', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: undefined,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('pill');
    if (slot.kind === 'pill') {
      expect(slot.label).toBe('defaultCardType');
    }
  });

  it('pill branch uses the supplied translator for label resolution', () => {
    const slot = resolveHeaderRightSlot(tConstant('Custom Fallback'), {
      cardType: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('pill');
    if (slot.kind === 'pill') {
      expect(slot.label).toBe('Custom Fallback');
    }
  });
});

describe('formatExpiryDateForHeader — locale-driven date formatting', () => {
  it('zh-TW locale: YYYY-MM-DD → YYYY.MM.DD', () => {
    expect(formatExpiryDateForHeader('2027-10-23', 'zh-TW')).toBe('2027.10.23');
  });

  it('en locale: YYYY-MM-DD → MM.DD.YYYY', () => {
    expect(formatExpiryDateForHeader('2027-10-23', 'en')).toBe('10.23.2027');
  });

  it('zh-CN locale: YYYY.MM.DD (same as zh-TW per "zh" prefix rule)', () => {
    expect(formatExpiryDateForHeader('2027-10-23', 'zh-CN')).toBe('2027.10.23');
  });

  it('empty string input → empty string output', () => {
    expect(formatExpiryDateForHeader('', 'en')).toBe('');
    expect(formatExpiryDateForHeader('', 'zh-TW')).toBe('');
  });

  it('malformed input (not YYYY-MM-DD) → returns input verbatim', () => {
    expect(formatExpiryDateForHeader('not-a-date', 'en')).toBe('not-a-date');
    expect(formatExpiryDateForHeader('2027/10/23', 'en')).toBe('2027/10/23');
  });

  it('locale=undefined → falls back to en format (MM.DD.YYYY)', () => {
    expect(formatExpiryDateForHeader('2027-10-23', '')).toBe('10.23.2027');
  });
});

/**
 * The `∞` sentinel value.
 *
 * `∞` (infinity) is the "never expires" marker of the header right
 * slot. It is used by:
 *   - `membership_card` when `hasExpiry` is false,
 *   - `coupon_card` when BOTH `passValidDays` and `expiryDate` are
 *     empty,
 *   - `discount_card` when BOTH `discountCustomExpiryDays` and
 *     `discountSpecificExpiryDate` are null.
 *
 * 2026-10-26: the discount card's "no expiry configured" fallback
 * changed from the em dash `—` to `∞`, so the editor preview and the
 * Wallet (which receives the very same sentinel from the runtime
 * formatter) can never disagree. The literal now lives in ONE place —
 * `packages/shared/constants/headerSlots.ts::UNLIMITED_EXPIRY_VALUE` —
 * and both surfaces read it from there.
 *
 * The sentinel is pinned HERE (the resolver layer) as well as at the
 * component layer, because the resolver is now the single owner of the
 * value computation: the editor preview (`PassCardPreviewHeader.tsx`)
 * and the template library preview (`TemplateCardPreview.tsx`) both
 * obtain them from `resolveHeaderRightSlot`, so a sentinel that
 * drifted in the resolver would silently change BOTH surfaces at once.
 */
describe('resolveHeaderRightSlot — the "no value" sentinel values', () => {
  it('membership_card + hasExpiry=false → "∞" (never expires)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: false,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('∞');
      expect(slot.testId).toBe('member-expiry-preview');
    }
  });

  it('membership_card + hasExpiry=true + expiryDate → a real date, never "∞"', () => {
    // The sentinel must NOT leak into the "has an expiry" branch.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'membership_card',
      hasExpiry: true,
      expiryDate: '2027-10-23',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('10.23.2027');
      expect(slot.value).not.toBe('∞');
    }
  });

  it('coupon_card + both passValidDays null AND expiryDate empty → "∞" (no implied expiry)', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'coupon_card',
      passValidDays: null,
      expiryDate: '',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('∞');
      expect(slot.testId).toBe('coupon-expiry-preview');
    }
  });

  it('coupon_card + passValidDays set → a real date, never "∞"', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'coupon_card',
      passValidDays: 7,
      expiryDate: '',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).not.toBe('∞');
      expect(slot.value).not.toBe('—');
    }
  });

  it('discount_card + both discount fields null → "∞" (never expires)', () => {
    // 2026-10-26: the discount card now uses the SAME `∞` sentinel as
    // membership / coupon — and as the Wallet runtime — so the editor
    // and the deployed pass can never show different "no expiry"
    // markers.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('∞');
      expect(slot.value).not.toBe('—');
      expect(slot.testId).toBe('discount-expiry-preview');
    }
  });

  it('discount_card + a real date → never "∞"', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-10-30',
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('10.30.2026');
      expect(slot.value).not.toBe('∞');
    }
  });

  it('the sentinels are locale-INVARIANT (no "∞" formatting drift)', () => {
    // The sentinels are universal across locales — the zh-TW surface must
    // show the same characters, not a localized variant.
    for (const locale of ['en', 'zh-TW', 'zh-CN']) {
      const membership = resolveHeaderRightSlot(tKey, {
        cardType: 'membership_card',
        hasExpiry: false,
        currency: 'TWD',
        locale,
      });
      const discount = resolveHeaderRightSlot(tKey, {
        cardType: 'discount_card',
        discountCustomExpiryDays: null,
        discountSpecificExpiryDate: null,
        currency: 'TWD',
        locale,
      });
      if (membership.kind === 'preview') expect(membership.value).toBe('∞');
      if (discount.kind === 'preview') expect(discount.value).toBe('∞');
    }
  });
});

/**
 * The `data-testid` each card type renders under.
 *
 * These selectors are the regression-test contract: the preview tests
 * query them to assert WHICH block rendered. They are declared in the
 * shared spec (`packages/shared/constants/headerSlots.ts`), so a drift
 * between the spec and the resolver would make a selector-based test
 * silently pass against the wrong element (or fail for the wrong
 * reason). The spec-side values are pinned in
 * `packages/shared/constants/headerSlots.test.ts`; here we pin that the
 * RESOLVER hands back exactly those spec values.
 */
describe('resolveHeaderRightSlot — test ids come from the shared spec', () => {
  it.each([
    ['membership_card', 'member-expiry-preview'],
    ['discount_card', 'discount-expiry-preview'],
    ['coupon_card', 'coupon-expiry-preview'],
    ['stamp_card', 'balance-preview'],
    ['reward_card', 'balance-preview'],
    ['cashback_card', 'balance-preview'],
    ['multipass', 'balance-preview'],
    ['gift_card', 'gift-points-preview'],
  ] as const)('cardType="%s" resolves to testId="%s"', (cardType, expectedTestId) => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.testId).toBe(expectedTestId);
    }
  });

  it.each([
    ['membership_card', 'memberExpiry.label'],
    ['discount_card', 'discountExpiry.label'],
    ['coupon_card', 'couponExpiry.label'],
    ['stamp_card', 'balancePreview.label'],
    ['reward_card', 'balancePreview.label'],
    ['cashback_card', 'balancePreview.label'],
    ['multipass', 'balancePreview.label'],
    ['gift_card', 'giftPointsPreview.label'],
  ] as const)('cardType="%s" resolves to label="%s"', (cardType, expectedLabel) => {
    // The label is the spec's `labelKey` passed through the translator —
    // the translator mock returns the key itself, so the resolved label
    // IS the spec's labelKey.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.label).toBe(expectedLabel);
    }
  });

  it('every card type resolves to a DISTINCT test id per header kind', () => {
    // Guards against two kinds accidentally sharing a selector (which
    // would make a selector-based test match the wrong element).
    const testIds = (
      ['membership_card', 'discount_card', 'coupon_card', 'stamp_card', 'gift_card'] as const
    ).map((cardType) => {
      const slot = resolveHeaderRightSlot(tKey, {
        cardType,
        currency: 'TWD',
        locale: 'en',
      });
      return slot.kind === 'preview' ? slot.testId : `pill:${cardType}`;
    });
    // The 4 balance card types share ONE id; the other 4 kinds have
    // their own. So there are exactly 5 distinct ids across the 5 kinds.
    expect(new Set(testIds).size).toBe(5);
  });
});

/**
 * An unknown (non-schema) card type string.
 *
 * The retired `shouldShowXxxPreview()` guards were typed
 * `(cardType: string | null | undefined)` and returned `false` for ANY
 * string outside their Sets — including strings that are not card types
 * at all. The shared lookup must keep that property: an unknown card
 * type must fall through to the default pill branch, never to a
 * half-resolved preview (and never to a thrown TypeError).
 */
describe('resolveHeaderRightSlot — unknown card type strings fall back to the pill', () => {
  it.each([
    ['not_a_card_type'],
    ['toString'],
    ['constructor'],
    ['__proto__'],
    ['hasOwnProperty'],
  ])('cardType="%s" → default pill (no preview, no throw)', (cardType) => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: cardType as never,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('pill');
    if (slot.kind === 'pill') {
      expect(slot.label).toBe('defaultCardType');
    }
  });

  it('cardType="" (empty string) → default pill', () => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: '' as never,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('pill');
  });
});

describe('resolveHeaderRightSlot — pure exhaustive cardType coverage', () => {
  // Every CardType has exactly one dedicated right-slot variant. Pin the
  // exhaustive mapping so a future CardType addition triggers a test update.
  it.each([
    ['stamp_card', 'preview'],
    ['reward_card', 'preview'],
    ['cashback_card', 'preview'],
    ['membership_card', 'preview'],
    ['discount_card', 'preview'],
    ['coupon_card', 'preview'],
    ['multipass', 'preview'],
    ['gift_card', 'preview'],
  ] as const)('%s → kind=%s (preview)', (cardType, expectedKind) => {
    const slot = resolveHeaderRightSlot(tKey, {
      cardType,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe(expectedKind);
  });
});

describe('deriveTemplateOverrides + resolveSlot — regression baseline (2026-10-04)', () => {
  // 2026-10-04 PR — Templates with `settings.membershipTiers[0].name`
  // populated must render the tier name in the preview (not the generic
  // "金級" / "Gold" string). Pin the integration here so a future change
  // to deriveTemplateOverrides / resolveSlot surfaces immediately.
  it('membership_card + memberLevel + membershipTiers[0].name="嗯嗯" → renders "嗯嗯"', () => {
    const settings = {
      membershipTiers: [{ name: '嗯嗯' }],
    };
    const overrides = deriveTemplateOverrides(settings);
    const slot = resolveSlot(tKey, {
      field: 'memberLevel',
      cardType: 'membership_card',
      currency: 'TWD',
      ...overrides,
    });
    expect(slot.value).toBe('嗯嗯');
    expect(slot.label).toBe('fieldPreview.memberLevel.label');
  });
});