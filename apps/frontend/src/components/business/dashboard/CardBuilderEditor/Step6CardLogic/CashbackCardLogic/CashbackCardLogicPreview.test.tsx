/**
 * CashbackCardLogicPreview — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Empty array → tierUnknown hint.
 *   - threshold=0 → noThreshold template (no amount shown).
 *   - threshold>0 (TWD zh-TW) → withThreshold template + 元 suffix.
 *   - threshold>0 (TWD en) → withThreshold template + NT$ prefix.
 *   - threshold>0 (ZAR) → withThreshold template + R prefix.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackCardLogicPreview } from './CashbackCardLogicPreview';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { Currency } from '@saome/shared/schemas/card';

let currentLanguage = 'zh-TW';
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn(
      (key: string, params?: Record<string, unknown>) =>
        params ? `${key}|${JSON.stringify(params)}` : key,
    ),
    i18n: { get language() { return currentLanguage; } },
  })),
}));

const seedTier = (tier: Partial<{
  name: string;
  thresholdSpend: number;
  cashbackPercent: number;
}>) => {
  useCardBuilderStore.setState({
    cashbackTiers: [
      {
        id: 'tier-x',
        name: tier.name ?? 'Test',
        thresholdSpend: tier.thresholdSpend ?? 0,
        cashbackPercent: tier.cashbackPercent ?? 5,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
  currentLanguage = 'zh-TW';
});

describe('CashbackCardLogicPreview', () => {
  it('renders empty hint when no tiers', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    render(<CashbackCardLogicPreview />);

    expect(
      screen.getByText('step6.cashback.preview.tierUnknown'),
    ).toBeInTheDocument();
  });

  it('renders noThreshold template when thresholdSpend === 0', () => {
    seedTier({ name: 'Default', thresholdSpend: 0, cashbackPercent: 1 });
    render(<CashbackCardLogicPreview />);

    // noThreshold template uses {{percent}} only
    const sentence = screen.getByText(
      /step6\.cashback\.preview\.noThreshold/,
    );
    expect(sentence).toBeInTheDocument();
    expect(sentence.textContent).toContain('"percent":1');
  });

  it('renders withThreshold template with TWD zh-TW suffix (元 key)', () => {
    currentLanguage = 'zh-TW';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ name: 'Gold', thresholdSpend: 1000, cashbackPercent: 5 });
    render(<CashbackCardLogicPreview />);

    const sentence = screen.getByText(/step6\.cashback\.preview\.withThreshold/);
    expect(sentence).toBeInTheDocument();
    // 中文 TWD: amount is "1000step6.cashback.tier.thresholdUnitTWD" (= "1000元")
    expect(sentence.textContent).toContain('1000step6.cashback.tier.thresholdUnitTWD');
  });

  it('renders withThreshold template with TWD en prefix (NT$ key)', () => {
    currentLanguage = 'en';
    useCardBuilderStore.setState({ currency: 'TWD' as Currency });
    seedTier({ name: 'Gold', thresholdSpend: 1000, cashbackPercent: 5 });
    render(<CashbackCardLogicPreview />);

    const sentence = screen.getByText(/step6\.cashback\.preview\.withThreshold/);
    // English TWD: amount is "step6.cashback.tier.thresholdUnitTWD1000" (= "NT$1000")
    expect(sentence.textContent).toContain('step6.cashback.tier.thresholdUnitTWD1000');
  });

  it('renders withThreshold template with ZAR prefix (R key)', () => {
    currentLanguage = 'en';
    useCardBuilderStore.setState({ currency: 'ZAR' as Currency });
    seedTier({ name: 'Gold', thresholdSpend: 1000, cashbackPercent: 5 });
    render(<CashbackCardLogicPreview />);

    const sentence = screen.getByText(/step6\.cashback\.preview\.withThreshold/);
    // ZAR: amount is "step6.cashback.tier.thresholdUnitZAR1000" (= "R1000")
    expect(sentence.textContent).toContain('step6.cashback.tier.thresholdUnitZAR1000');
  });
});
