/**
 * CashbackTierList — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Renders empty state hint when cashbackTiers is empty.
 *   - Renders one CashbackTierRow per tier.
 *   - "新增回饋級距" button appends a new tier via addCashbackTier.
 *   - Button is disabled at MAX_CASHBACK_TIERS=5.
 *   - "maxTiersReached" hint is shown when at cap.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackTierList } from './CashbackTierList';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_CASHBACK_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock CashbackTierRow to count renders without depending on sub-fields.
let tierRowRenderCount = 0;
vi.mock('./CashbackTierRow', () => ({
  CashbackTierRow: ({ tierId }: { tierId: string }) => {
    tierRowRenderCount += 1;
    return <div data-testid={`cashback-tier-row-${tierId}`}>TierRow</div>;
  },
}));

afterEach(() => {
  tierRowRenderCount = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CashbackTierList — CRUD', () => {
  it('renders empty state hint when cashbackTiers is empty', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    render(<CashbackTierList showValidation={false} />);

    expect(screen.getByText('step6.cashback.preview.tierUnknown')).toBeInTheDocument();
  });

  it('renders one CashbackTierRow per tier', () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        { id: 'a', name: 'A', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 'b', name: 'B', thresholdSpend: 1000, cashbackPercent: 5 },
      ],
    });
    render(<CashbackTierList showValidation={false} />);

    expect(screen.getByTestId('cashback-tier-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('cashback-tier-row-b')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(2);
  });

  it('"新增回饋級距" button appends a new tier', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    render(<CashbackTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.cashback.addTier' });
    fireEvent.click(addBtn);

    expect(useCardBuilderStore.getState().cashbackTiers.length).toBe(1);
  });

  it('button is disabled at MAX_CASHBACK_TIERS=5', () => {
    // Fill up to MAX_CASHBACK_TIERS
    const tiers = Array.from({ length: MAX_CASHBACK_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      cashbackPercent: 1,
    }));
    useCardBuilderStore.setState({ cashbackTiers: tiers });

    render(<CashbackTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.cashback.addTier' });
    expect(addBtn).toBeDisabled();
  });

  it('shows maxTiersReached hint when at cap', () => {
    const tiers = Array.from({ length: MAX_CASHBACK_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      cashbackPercent: 1,
    }));
    useCardBuilderStore.setState({ cashbackTiers: tiers });

    render(<CashbackTierList showValidation={false} />);

    expect(
      screen.getByText('step6.cashback.maxTiersReached'),
    ).toBeInTheDocument();
  });
});
