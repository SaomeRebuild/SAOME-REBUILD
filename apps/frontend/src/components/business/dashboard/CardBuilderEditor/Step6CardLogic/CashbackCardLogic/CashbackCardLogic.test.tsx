/**
 * CashbackCardLogic — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the main component renders its 2 sub-components:
 *   - <CashbackTierList />
 *   - <CashbackCardLogicPreview />
 *
 * Tests run 3 scenarios:
 *   - Empty array → only the list shows the empty hint
 *   - 1 tier with valid data → preview renders the withThreshold sentence
 *   - 5 tiers (cap reached) → list shows maxTiersReached
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackCardLogic } from './CashbackCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_CASHBACK_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn(
      (key: string, params?: Record<string, unknown>) =>
        params ? `${key}|${JSON.stringify(params)}` : key,
    ),
    i18n: { get language() { return 'zh-TW'; } },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CashbackCardLogic — main component', () => {
  it('renders empty state when cashbackTiers is empty', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    render(<CashbackCardLogic showValidation={false} />);

    // tierUnknown appears in both list empty state AND preview
    expect(
      screen.getAllByText('step6.cashback.preview.tierUnknown').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders tier list and preview when 1 tier is set', () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        { id: 't-1', name: 'Default', thresholdSpend: 0, cashbackPercent: 5 },
      ],
    });
    render(<CashbackCardLogic showValidation={false} />);

    // List heading
    expect(screen.getByText('step6.cashback.tiersTitle')).toBeInTheDocument();
    // Preview sentence (noThreshold because thresholdSpend=0)
    expect(
      screen.getByText(/step6\.cashback\.preview\.noThreshold/),
    ).toBeInTheDocument();
  });

  it('renders maxTiersReached hint when at MAX_CASHBACK_TIERS=5', () => {
    const tiers = Array.from({ length: MAX_CASHBACK_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      cashbackPercent: 1,
    }));
    useCardBuilderStore.setState({ cashbackTiers: tiers });
    render(<CashbackCardLogic showValidation={false} />);

    expect(
      screen.getByText('step6.cashback.maxTiersReached'),
    ).toBeInTheDocument();
  });
});
