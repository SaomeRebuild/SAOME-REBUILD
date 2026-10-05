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

  it('2. discount_card + both discount fields null → "—" fallback', () => {
    // Theoretical — Step 6 requires one. The helper renders "—" defensively.
    const slot = resolveHeaderRightSlot(tKey, {
      cardType: 'discount_card',
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
      currency: 'TWD',
      locale: 'en',
    });
    expect(slot.kind).toBe('preview');
    if (slot.kind === 'preview') {
      expect(slot.value).toBe('—');
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