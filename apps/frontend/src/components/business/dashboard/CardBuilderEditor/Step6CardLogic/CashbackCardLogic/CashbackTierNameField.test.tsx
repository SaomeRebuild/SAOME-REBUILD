/**
 * CashbackTierNameField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Renders text input with current name.
 *   - Updates store on input change.
 *   - Truncates input > CASHBACK_TIER_NAME_MAX_LENGTH (40 chars).
 *   - Shows requiredError when showValidation=true && name is empty.
 *   - Returns null when tier does not exist.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackTierNameField } from './CashbackTierNameField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { CASHBACK_TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

const seedTier = (overrides: Partial<{ name: string }> = {}) => {
  useCardBuilderStore.setState({
    cashbackTiers: [
      {
        id: 'tier-x',
        name: overrides.name ?? '',
        thresholdSpend: 1000,
        cashbackPercent: 5,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CashbackTierNameField', () => {
  it('renders text input with current name', () => {
    seedTier({ name: 'VIP' });
    render(<CashbackTierNameField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('VIP');
  });

  it('updates store on input change', () => {
    seedTier({ name: '' });
    render(<CashbackTierNameField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Gold' } });

    expect(useCardBuilderStore.getState().cashbackTiers[0]!.name).toBe('Gold');
  });

  it('enforces maxLength attribute', () => {
    seedTier();
    render(<CashbackTierNameField showValidation={false} tierId="tier-x" />);

    const input = screen.getByRole('textbox');
    expect(input.getAttribute('maxLength')).toBe(String(CASHBACK_TIER_NAME_MAX_LENGTH));
  });

  it('shows requiredError when showValidation=true && name is empty', () => {
    seedTier({ name: '' });
    render(<CashbackTierNameField showValidation={true} tierId="tier-x" />);

    expect(
      screen.getByText('step6.cashback.tier.nameRequiredError'),
    ).toBeInTheDocument();
  });

  it('does NOT show requiredError when name is non-empty', () => {
    seedTier({ name: 'Gold' });
    render(<CashbackTierNameField showValidation={true} tierId="tier-x" />);

    expect(
      screen.queryByText('step6.cashback.tier.nameRequiredError'),
    ).not.toBeInTheDocument();
  });

  it('returns null when tier does not exist', () => {
    useCardBuilderStore.setState({ cashbackTiers: [] });
    const { container } = render(
      <CashbackTierNameField showValidation={false} tierId="ghost" />,
    );
    expect(container.firstChild).toBeNull();
  });
});
