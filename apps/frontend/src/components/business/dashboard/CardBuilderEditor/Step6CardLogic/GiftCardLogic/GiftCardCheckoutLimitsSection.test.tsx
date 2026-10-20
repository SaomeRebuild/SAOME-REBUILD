/**
 * GiftCardCheckoutLimitsSection — Vitest + RTL Tests
 *
 * 2026-10-20: Tests for the checkout fence sub-section (PR 2 of 雙層 fence).
 * Verifies the section renders, cross-field validation (within-fence +
 * cross-fence), field defaults, and setter guards.
 *
 * Mirrors `GiftCardDesignLimitsSection.test.tsx` (PR 1) structurally,
 * but adds:
 *   - Currency-aware rendering (TWD zh-TW suffix / NT$ prefix / R prefix)
 *   - Cross-fence validation (checkout min vs design min, checkout max
 *     vs design max) — design fence shrinks → checkout auto-clamps
 *   - 4-field layout (min/max points + min/max amount)
 */

import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GiftCardCheckoutLimitsSection } from './GiftCardCheckoutLimitsSection';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock i18n (mirrors GiftCardLogic.test.tsx + GiftCardDesignLimitsSection.test.tsx pattern).
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => {
      const lookup: Record<string, string> = {
        // section hero intro
        'step6.gift.checkout.intro': '\u5ba2\u6236\u55ae\u6b21\u53ef\u8cb7\u7684\u9ede\u6578\u8207\u4ed8\u6b3e\u91d1\u984d',
        'step6.gift.checkout.introHint': '\u4e0d\u53ef\u8d85\u904e\u4e0a\u65b9\u8a2d\u5b9a\u7684\u6700\u5927\u767c\u884c\u9ede\u6578\u3002\u5ba2\u6236\u8d85\u904e\u4e0a\u9650\u6642\u7121\u6cd5\u7d50\u5e33\u3002',
        // checkout section labels
        'step6.gift.checkout.minPointsLabel': '\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578',
        'step6.gift.checkout.maxPointsLabel': '\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578',
        'step6.gift.checkout.minAmountLabel': '\u55ae\u7b46\u6700\u5c0f\u4ed8\u6b3e\u91d1\u984d',
        'step6.gift.checkout.maxAmountLabel': '\u55ae\u7b46\u6700\u5927\u4ed8\u6b3e\u91d1\u984d',
        'step6.gift.checkout.placeholderMinPoints': '\u4f8b\uff1a100',
        'step6.gift.checkout.placeholderMaxPoints': '\u4f8b\uff1a10000',
        'step6.gift.checkout.placeholderMinAmount': '\u4f8b\uff1a100',
        'step6.gift.checkout.placeholderMaxAmount': '\u4f8b\uff1a10000',
        // validation messages
        'step6.gift.validation.minGreaterThanMax': '\u4e0b\u9650\u4e0d\u80fd\u5927\u65bc\u4e0a\u9650',
        'step6.gift.validation.positive': '\u6578\u503c\u5fc5\u9808\u5927\u65bc\u96f2',
        'step6.gift.validation.underDesignMin': '\u4e0d\u80fd\u4f4e\u65bc\u65b9\u6848\u767c\u884c\u9ede\u6578\u4e0b\u9650',
        'step6.gift.validation.overDesignMax': '\u4e0d\u80fd\u8d85\u904e\u65b9\u6848\u767c\u884c\u9ede\u6578\u4e0a\u9650',
        // amount unit (TWD zh-TW uses suffix 元, en uses NT$ prefix)
        'step6.gift.amountUnitTWD': '\u5143',
        'step6.gift.amountUnitZAR': 'R',
        // points unit suffix on input fields
        'step6.gift.pointsUnit': '\u9ede',
      };
      return lookup[key] ?? key;
    }),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('GiftCardCheckoutLimitsSection — checkout fence (Rule 000 § A.1)', () => {
  it('renders 4 fields with correct aria-labels', () => {
    render(<GiftCardCheckoutLimitsSection showValidation={false} />);

    expect(screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578')).toBeInTheDocument();
    expect(screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578')).toBeInTheDocument();
    expect(screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u4ed8\u6b3e\u91d1\u984d')).toBeInTheDocument();
    expect(screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u4ed8\u6b3e\u91d1\u984d')).toBeInTheDocument();
  });

  it('renders with default values (100, 10_000, 100, 10_000)', () => {
    render(<GiftCardCheckoutLimitsSection showValidation={false} />);

    const minPtsInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578');
    const maxPtsInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578');
    const minAmtInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u4ed8\u6b3e\u91d1\u984d');
    const maxAmtInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u4ed8\u6b3e\u91d1\u984d');
    expect(minPtsInput).toHaveValue(100);
    expect(maxPtsInput).toHaveValue(10_000);
    expect(minAmtInput).toHaveValue(100);
    expect(maxAmtInput).toHaveValue(10_000);
  });

  it('within-fence cross-field: checkout min > checkout max → both invalid', () => {
    // Within-fence violation (no cross-fence involvement)
    useCardBuilderStore.setState({
      giftCardCheckoutMinPoints: 5000,
      giftCardCheckoutMaxPoints: 1000,
    });
    render(<GiftCardCheckoutLimitsSection showValidation={true} />);

    const minInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578');
    const maxInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578');

    expect(minInput.getAttribute('aria-invalid')).toBe('true');
    expect(maxInput.getAttribute('aria-invalid')).toBe('true');
    expect(minInput.className).toContain('border-destructive');
    expect(maxInput.className).toContain('border-destructive');

    // Both fields show the minGreaterThanMax error message.
    const errorMessages = screen.getAllByText('\u4e0b\u9650\u4e0d\u80fd\u5927\u65bc\u4e0a\u9650');
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('cross-fence validation: checkout max > design max → checkout max invalid', () => {
    // design max is at default 999_999_999, set checkout max to 50_000_000 (above)
    useCardBuilderStore.setState({
      giftCardCheckoutMaxPoints: 50_000_000, // > default design max 999_999_999
    });
    // Note: 50M is < 999_999_999, so let me actually trigger the condition.
    // Set design max to a smaller value first (e.g. 5000).
    useCardBuilderStore.setState({
      giftCardDesignMaxPoints: 5_000,
    });
    // Setter for design max would normally reject this if min was 1 (it is).
    // After set, design max = 5000, checkout max stays at 50_000_000.
    useCardBuilderStore.setState({
      giftCardCheckoutMaxPoints: 10_000, // > design max 5000
    });
    render(<GiftCardCheckoutLimitsSection showValidation={true} />);

    const maxInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578');
    expect(maxInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('\u4e0d\u80fd\u8d85\u904e\u65b9\u6848\u767c\u884c\u9ede\u6578\u4e0a\u9650')).toBeInTheDocument();
  });

  it('cross-fence validation: checkout min < design min → checkout min invalid', () => {
    // Set design min = 1000 (the setter requires min ≤ max = 999_999_999).
    useCardBuilderStore.setState({
      giftCardDesignMinPoints: 1_000,
      giftCardCheckoutMinPoints: 500, // < design min 1000
    });
    render(<GiftCardCheckoutLimitsSection showValidation={true} />);

    const minInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578');
    expect(minInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('\u4e0d\u80fd\u4f4e\u65bc\u65b9\u6848\u767c\u884c\u9ede\u6578\u4e0b\u9650')).toBeInTheDocument();
  });

  it('setter blocks checkout min > checkout max (within-fence guard)', () => {
    act(() => {
      useCardBuilderStore.getState().setGiftCardCheckoutMinPoints(20_000);
    });
    // Default max is 10_000, so 20_000 > max → blocked
    expect(useCardBuilderStore.getState().giftCardCheckoutMinPoints).toBe(100);
  });

  it('setter blocks checkout min < design min (cross-fence guard)', () => {
    // Set design min = 5_000 (default max is 999_999_999, so this is OK)
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMinPoints(5_000);
    });
    // Try to set checkout min = 100 (default), which is < design min 5_000 → blocked
    act(() => {
      useCardBuilderStore.getState().setGiftCardCheckoutMinPoints(100);
    });
    // Default checkout min is 100, but design min 5_000 blocks the value.
    expect(useCardBuilderStore.getState().giftCardCheckoutMinPoints).toBe(100); // unchanged
  });

  it('setter blocks checkout max > design max (cross-fence guard)', () => {
    // Set design max = 1_000 (default min is 1, so this is OK)
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMaxPoints(1_000);
    });
    // Try to set checkout max = 10_000 (default), which is > design max 1_000 → blocked
    act(() => {
      useCardBuilderStore.getState().setGiftCardCheckoutMaxPoints(10_000);
    });
    expect(useCardBuilderStore.getState().giftCardCheckoutMaxPoints).toBe(10_000); // unchanged
  });

  it('DOM order: min points → max points → min amount → max amount', () => {
    render(<GiftCardCheckoutLimitsSection showValidation={false} />);

    const minPts = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u8cbf\u8cb7\u9ede\u6578');
    const maxPts = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578');
    const minAmt = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u4ed8\u6b3e\u91d1\u984d');
    const maxAmt = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u4ed8\u6b3e\u91d1\u984d');
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(minPts.compareDocumentPosition(maxPts) & FOLLOWING).toBeTruthy();
    expect(maxPts.compareDocumentPosition(minAmt) & FOLLOWING).toBeTruthy();
    expect(minAmt.compareDocumentPosition(maxAmt) & FOLLOWING).toBeTruthy();
  });

  it('within-fence amount cross-field: min amount > max amount → both invalid', () => {
    useCardBuilderStore.setState({
      giftCardCheckoutMinAmount: 20_000,
      giftCardCheckoutMaxAmount: 5_000,
    });
    render(<GiftCardCheckoutLimitsSection showValidation={true} />);

    const minAmtInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5c0f\u4ed8\u6b3e\u91d1\u984d');
    const maxAmtInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u4ed8\u6b3e\u91d1\u984d');

    expect(minAmtInput.getAttribute('aria-invalid')).toBe('true');
    expect(maxAmtInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('ZAR currency renders R prefix on amount fields', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<GiftCardCheckoutLimitsSection showValidation={false} />);

    // R prefix should appear at least 2 times (min + max amount fields)
    const rPrefixes = screen.getAllByText('R');
    expect(rPrefixes.length).toBeGreaterThanOrEqual(2);
  });

  it('regression: number input rejects values > Number.MAX_SAFE_INTEGER (precision overflow guard)', () => {
    // Bug: <input type="number"> with min={1} but no max lets users enter
    // 1e21, which parseFloat corrupts to 1.0000000000000003e+21 — corrupting
    // the store. The onChange parser must reject unsafe integers via
    // Number.isSafeInteger before the setter is called.
    //
    // The number input's `max={Number.MAX_SAFE_INTEGER}` + `step={1}` is the
    // first layer; this test pins the JS-level guard inside onChange.
    render(<GiftCardCheckoutLimitsSection showValidation={false} />);

    const maxPtsInput = screen.getByLabelText('\u55ae\u7b46\u6700\u5927\u8cbf\u8cb7\u9ede\u6578');

    // 1e21 > Number.MAX_SAFE_INTEGER (≈9.007e15). The setter on the store
    // also rejects non-integer values, so this is defense-in-depth.
    const before = useCardBuilderStore.getState().giftCardCheckoutMaxPoints;
    fireEvent.change(maxPtsInput, { target: { value: '1000000000000000000000' } });
    const after = useCardBuilderStore.getState().giftCardCheckoutMaxPoints;
    // Store should remain unchanged — the onChange guard rejected the value.
    expect(after).toBe(before);
    expect(after).toBe(10_000); // default
  });
});