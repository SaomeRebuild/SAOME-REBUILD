/**
 * DiscountTierThresholdField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Currency-aware rendering for 3 cases (mirrors
 *     CashbackTierThresholdField 2026-09-11 pattern):
 *     - TWD zh-TW: suffix "step6.discount.tier.thresholdUnitTWD" (= "元")
 *     - TWD en:    prefix "step6.discount.tier.thresholdUnitTWD" (= "NT$")
 *     - ZAR:       prefix "step6.discount.tier.thresholdUnitZAR" (= "R")
 *   - Always shows numeric value (including 0) — same fix as cashback:
 *     0 displays as "0" in the input, not empty.
 *   - Store update on change (calls updateDiscountTier).
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscountTierThresholdField } from './DiscountTierThresholdField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { Currency } from '@saome/shared/schemas/card';

// Mock i18n with controllable language + a passthrough t().
let currentLanguage = 'zh-TW';
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { get language() { return currentLanguage; } },
  })),
}));

// Seed a tier with a non-zero threshold so the input renders (not the zero hint).
const seedTier = (overrides: Partial<{
  thresholdSpend: number;
}> = {}) => {
  useCardBuilderStore.setState({
    discountTiers: [
      {
        id: 'tier-x',
        name: 'Test tier',
        thresholdSpend: overrides.thresholdSpend ?? 1000,
        discountPercent: 5,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
  currentLanguage = 'zh-TW';
});

describe('DiscountTierThresholdField — currency-aware rendering', () => {
  it('TWD zh-TW: input is followed by unit suffix (元 placement)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    const { container } = render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    // 中文 TWD: no prefix span, input first, unit suffix second
    expect(row.firstElementChild?.tagName).toBe('INPUT');
    expect(row.lastElementChild?.tagName).toBe('SPAN');
    expect(row.lastElementChild?.textContent).toBe('step6.discount.tier.thresholdUnitTWD');
  });

  it('TWD en: unit prefix (NT$) is followed by input', () => {
    currentLanguage = 'en';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    const { container } = render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    // English TWD: prefix span first, input second, no suffix span
    expect(row.firstElementChild?.tagName).toBe('SPAN');
    expect(row.firstElementChild?.textContent).toBe('step6.discount.tier.thresholdUnitTWD');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });

  it('ZAR: prefix "R" is rendered regardless of locale', () => {
    // ZAR unit is a prefix in both zh-TW and en locales.
    for (const locale of ['zh-TW', 'en']) {
      currentLanguage = locale;
      useCardBuilderStore.setState({ currency: 'ZAR' as Currency });
      seedTier({ thresholdSpend: 1000 });
      cleanup();
      const { container } = render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

      const row = container.querySelector('div.flex.items-center.gap-2')!;
      expect(row.firstElementChild?.tagName).toBe('SPAN');
      expect(row.firstElementChild?.textContent).toBe('step6.discount.tier.thresholdUnitZAR');
      expect(row.lastElementChild?.tagName).toBe('INPUT');

      // Reset for next iteration
      useCardBuilderStore.getState().reset();
    }
  });

  it('always shows numeric value (thresholdSpend=0 renders as "0" in input)', () => {
    // Mirrors the CashbackTierThresholdField 2026-09-11 fix:
    // 0 must display as "0", not empty (so the placeholder's "輸入 0"
    // hint makes sense).
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 0 });

    render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0);
  });

  it('updates the store via updateDiscountTier on input change', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5000' } });

    expect(useCardBuilderStore.getState().discountTiers[0].thresholdSpend).toBe(5000);
  });

  it('rejects negative threshold (keeps previous value)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-100' } });

    // Store guard: stays at 1000 (the previous valid value).
    expect(useCardBuilderStore.getState().discountTiers[0].thresholdSpend).toBe(1000);
  });

  it('empty input resets to 0 (default tier / no threshold)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    render(<DiscountTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });

    expect(useCardBuilderStore.getState().discountTiers[0].thresholdSpend).toBe(0);
  });
});
