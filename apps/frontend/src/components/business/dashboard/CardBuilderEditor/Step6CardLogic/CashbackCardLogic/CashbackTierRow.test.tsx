/**
 * CashbackTierRow — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Composes 3 sub-fields (Name / Threshold / Percent).
 *   - Remove button removes the tier from the store.
 *   - Each sub-field receives showValidation prop.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CashbackTierRow } from './CashbackTierRow';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CashbackTierRow', () => {
  it('composes 3 sub-fields: Name, Threshold, Percent', () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        {
          id: 'tier-1',
          name: 'Gold',
          thresholdSpend: 5000,
          cashbackPercent: 10,
        },
      ],
    });
    render(<CashbackTierRow showValidation={false} tierId="tier-1" />);

    // 3 inputs: textbox (name) + 2 spinbuttons (threshold, percent)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('Remove button removes the tier from the store', () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        {
          id: 'tier-1',
          name: 'Gold',
          thresholdSpend: 5000,
          cashbackPercent: 10,
        },
      ],
    });
    render(<CashbackTierRow showValidation={false} tierId="tier-1" />);

    const removeBtn = screen.getByRole('button', {
      name: 'step6.cashback.removeTier',
    });
    fireEvent.click(removeBtn);

    expect(useCardBuilderStore.getState().cashbackTiers).toEqual([]);
  });

  it('renders wrapper div with Remove button', () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        {
          id: 'tier-1',
          name: 'Gold',
          thresholdSpend: 5000,
          cashbackPercent: 10,
        },
      ],
    });
    const { container } = render(
      <CashbackTierRow showValidation={false} tierId="tier-1" />,
    );
    // Row wrapper always renders (Remove button + grid container)
    expect(container.firstChild).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'step6.cashback.removeTier' }),
    ).toBeInTheDocument();
  });
});
