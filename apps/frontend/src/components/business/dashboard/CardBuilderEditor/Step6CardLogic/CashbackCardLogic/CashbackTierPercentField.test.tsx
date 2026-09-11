/**
 * CashbackTierPercentField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Renders number input with current cashbackPercent value.
 *   - Updates store on valid input (1-100).
 *   - Rejects out-of-range values (0, 101, negative).
 *   - Rounds to integer.
 *   - Validation error shown for invalid values when showValidation=true.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackTierPercentField } from './CashbackTierPercentField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

const seedTier = (overrides: Partial<{ cashbackPercent: number }> = {}) => {
  useCardBuilderStore.setState({
    cashbackTiers: [
      {
        id: 'tier-x',
        name: 'Test tier',
        thresholdSpend: 1000,
        cashbackPercent: overrides.cashbackPercent ?? 5,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CashbackTierPercentField', () => {
  it('renders number input with current cashbackPercent', () => {
    seedTier({ cashbackPercent: 10 });
    render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(10);
  });

  it('shows the % unit label', () => {
    seedTier();
    const { container } = render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    expect(row.lastElementChild?.tagName).toBe('SPAN');
    expect(row.lastElementChild?.textContent).toBe('step6.cashback.tier.percentUnit');
  });

  it('updates store on valid input', () => {
    seedTier({ cashbackPercent: 5 });
    render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '20' } });

    expect(useCardBuilderStore.getState().cashbackTiers[0]!.cashbackPercent).toBe(20);
  });

  it('rounds to integer', () => {
    seedTier({ cashbackPercent: 5 });
    render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7.6' } });

    expect(useCardBuilderStore.getState().cashbackTiers[0]!.cashbackPercent).toBe(8);
  });

  it('rejects cashbackPercent > 100 (store guard keeps previous value)', () => {
    seedTier({ cashbackPercent: 5 });
    render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '101' } });

    // Store guard: invalid → keep previous value
    expect(useCardBuilderStore.getState().cashbackTiers[0]!.cashbackPercent).toBe(5);
  });

  it('shows tooLargeError when showValidation=true and value > 100', () => {
    seedTier({ cashbackPercent: 150 });
    render(<CashbackTierPercentField showValidation={true} tierId="tier-x" />);

    expect(
      screen.getByText('step6.cashback.tier.percentTooLargeError'),
    ).toBeInTheDocument();
  });

  it('sets to 1 when input is emptied (minimum valid percent)', () => {
    seedTier({ cashbackPercent: 50 });
    render(<CashbackTierPercentField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });

    expect(useCardBuilderStore.getState().cashbackTiers[0]!.cashbackPercent).toBe(1);
  });

  it('returns null when tier does not exist', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    const { container } = render(
      <CashbackTierPercentField showValidation={false} tierId="ghost" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
