/**
 * CashbackTierThresholdField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Currency-aware rendering for 3 cases:
 *     - TWD zh-TW: suffix "step6.cashback.tier.thresholdUnitTWD" (= "元")
 *     - TWD en:    prefix "step6.cashback.tier.thresholdUnitTWD" (= "NT$")
 *     - ZAR:       prefix "step6.cashback.tier.thresholdUnitZAR" (= "R")
 *   - Always shows numeric value (2026-09-11 update): thresholdSpend=0
 *     displays as "0" in the input (not empty). Empty-value rendering was
 *     removed because it made the placeholder's "輸入 0" instruction
 *     feel broken (typing 0 was silently re-rendered to empty).
 *   - Store update on change (calls updateCashbackTier).
 *
 * Plan ref: Step 6 CashbackCardLogic 2026-09-11 § Phase 7.2.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackTierThresholdField } from './CashbackTierThresholdField';
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
    cashbackTiers: [
      {
        id: 'tier-x',
        name: 'Test tier',
        thresholdSpend: overrides.thresholdSpend ?? 1000,
        cashbackPercent: 5,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
  currentLanguage = 'zh-TW';
});

describe('CashbackTierThresholdField — currency-aware rendering', () => {
  it('TWD zh-TW: input is followed by unit suffix (元 placement)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    const { container } = render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    // 中文 TWD: no prefix span, input first, unit suffix second
    expect(row.firstElementChild?.tagName).toBe('INPUT');
    expect(row.lastElementChild?.tagName).toBe('SPAN');
    expect(row.lastElementChild?.textContent).toBe('step6.cashback.tier.thresholdUnitTWD');
  });

  it('TWD en: unit prefix (NT$) is followed by input', () => {
    currentLanguage = 'en';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    const { container } = render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    // English TWD: NT$ prefix first, input second
    expect(row.firstElementChild?.tagName).toBe('SPAN');
    expect(row.firstElementChild?.textContent).toBe('step6.cashback.tier.thresholdUnitTWD');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });

  it('ZAR: unit prefix (R) is followed by input', () => {
    currentLanguage = 'en';
    useCardBuilderStore.setState({ currency: 'ZAR' as Currency });
    seedTier({ thresholdSpend: 1000 });

    const { container } = render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    // ZAR: R prefix first, input second
    expect(row.firstElementChild?.tagName).toBe('SPAN');
    expect(row.firstElementChild?.textContent).toBe('step6.cashback.tier.thresholdUnitZAR');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });

  it('thresholdSpend = 0 renders input with value "0" (placeholder visible only if value empty)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 0 });

    render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    // Input IS rendered (always), with value "0" visible.
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0);
    // Placeholder still set (for screen readers), but visually hidden because value is shown.
    expect(input).toHaveAttribute('placeholder', 'step6.cashback.tier.thresholdPlaceholder');
    // Helper text below input explains the 0 meaning.
    expect(screen.getByText('step6.cashback.tier.thresholdHelper')).toBeInTheDocument();
  });

  it('thresholdSpend > 0 renders input with value, helper text below', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ thresholdSpend: 1000 });

    render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1000);
    expect(input).toHaveAttribute('placeholder', 'step6.cashback.tier.thresholdPlaceholder');
    expect(screen.getByText('step6.cashback.tier.thresholdHelper')).toBeInTheDocument();
  });
});

describe('CashbackTierThresholdField — store interaction', () => {
  it('updates thresholdSpend on change', () => {
    seedTier({ thresholdSpend: 100 });

    render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '500' } });

    expect(
      useCardBuilderStore.getState().cashbackTiers[0]!.thresholdSpend,
    ).toBe(500);
  });

  it('clears threshold back to 0 (default tier) when input is emptied', () => {
    seedTier({ thresholdSpend: 1000 });

    render(<CashbackTierThresholdField showValidation={false} tierId="tier-x" />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });

    expect(
      useCardBuilderStore.getState().cashbackTiers[0]!.thresholdSpend,
    ).toBe(0);
  });
});
