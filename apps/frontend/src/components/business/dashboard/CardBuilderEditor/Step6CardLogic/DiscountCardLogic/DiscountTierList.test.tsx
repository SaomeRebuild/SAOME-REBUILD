/**
 * DiscountTierList — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Mirrors the CashbackTierList pattern (2026-09-11) but with 3 differences:
 *   1. Uses discountTiers / addDiscountTier from the store
 *   2. Always ≥ 1 row (the store seeds a default-discount-tier on reset)
 *   3. Renders the new DiscountTierRow sub-component (not CashbackTierRow)
 *
 * Verifies:
 *   - Renders one DiscountTierRow per tier.
 *   - "新增折扣級距" button appends a new tier via addDiscountTier.
 *   - Button is disabled at MAX_DISCOUNT_TIERS=5.
 *   - "maxTiersReached" hint is shown when at cap.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscountTierList } from './DiscountTierList';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock DiscountTierRow to count renders without depending on sub-fields.
let tierRowRenderCount = 0;
vi.mock('./DiscountTierRow', () => ({
  DiscountTierRow: ({ tierId }: { tierId: string }) => {
    tierRowRenderCount += 1;
    return <div data-testid={`discount-tier-row-${tierId}`}>TierRow</div>;
  },
}));

afterEach(() => {
  tierRowRenderCount = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('DiscountTierList — CRUD', () => {
  it('renders one DiscountTierRow per tier', () => {
    useCardBuilderStore.setState({
      discountTiers: [
        { id: 'a', name: 'A', thresholdSpend: 0, discountPercent: 1 },
        { id: 'b', name: 'B', thresholdSpend: 1000, discountPercent: 5 },
      ],
    });
    render(<DiscountTierList showValidation={false} />);

    expect(screen.getByTestId('discount-tier-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('discount-tier-row-b')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(2);
  });

  it('renders the seeded default-discount-tier on first mount', () => {
    // After reset() the store seeds 1 default tier with id='default-discount-tier'.
    // The list should render 1 row even though the user hasn't clicked Add yet.
    render(<DiscountTierList showValidation={false} />);
    expect(screen.getByTestId('discount-tier-row-default-discount-tier')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(1);
  });

  it('"新增折扣級距" button appends a new tier', () => {
    useCardBuilderStore.setState({ discountTiers: [] });
    render(<DiscountTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.discount.addTier' });
    fireEvent.click(addBtn);

    expect(useCardBuilderStore.getState().discountTiers.length).toBe(1);
  });

  it('button is disabled at MAX_DISCOUNT_TIERS=5', () => {
    // Fill up to MAX_DISCOUNT_TIERS
    const tiers = Array.from({ length: MAX_DISCOUNT_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      discountPercent: 1,
    }));
    useCardBuilderStore.setState({ discountTiers: tiers });

    render(<DiscountTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.discount.addTier' });
    expect(addBtn).toBeDisabled();
  });

  it('shows maxTiersReached hint when at cap', () => {
    const tiers = Array.from({ length: MAX_DISCOUNT_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      discountPercent: 1,
    }));
    useCardBuilderStore.setState({ discountTiers: tiers });

    render(<DiscountTierList showValidation={false} />);

    expect(
      screen.getByText('step6.discount.maxTiersReached'),
    ).toBeInTheDocument();
  });
});
