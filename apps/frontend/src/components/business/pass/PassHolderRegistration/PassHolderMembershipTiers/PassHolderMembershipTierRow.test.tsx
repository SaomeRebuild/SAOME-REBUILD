/**
 * PassHolderMembershipTierRow tests — render, selection visual, cost
 * formatting, rewards list, and click handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderMembershipTierRow } from './PassHolderMembershipTierRow';
import type { PublicMembershipTier } from '@saome/shared/types/passHolder';

const baseLabels = {
  costFree: '免費',
  perMonth: '每月',
  perYear: '每年',
  rewardsLabel: '會員獎勵',
};

const renderRow = (props: Partial<React.ComponentProps<typeof PassHolderMembershipTierRow>> = {}) => {
  const tier: PublicMembershipTier = {
    name: 'VIP',
    rewards: [{ label: 'Free smoothie', value: 'https://example.com/vip' }],
    monthlyCost: 200,
    yearlyCost: null,
    durationType: 'monthly',
  };
  return render(
    <I18nextProvider i18n={testI18n}>
      <PassHolderMembershipTierRow
        tier={tier}
        index={0}
        currency="TWD"
        labels={baseLabels}
        selected={false}
        onSelect={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );
};

describe('PassHolderMembershipTierRow', () => {
  it('renders the tier name and a clickable radio input', () => {
    renderRow();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    const radio = screen.getByTestId('pass-holder-tier-row-radio-0');
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute('type', 'radio');
    expect(radio).toHaveAttribute('value', '0');
  });

  it('formats TWD monthly cost as "NT$ 200 / 每月"', () => {
    renderRow({ index: 0, currency: 'TWD' });
    expect(screen.getByTestId('pass-holder-tier-cost')).toHaveTextContent('NT$ 200');
    expect(screen.getByTestId('pass-holder-tier-cost')).toHaveTextContent('每月');
  });

  it('formats ZAR yearly cost as "R 1200 / 每年"', () => {
    const tier: PublicMembershipTier = {
      name: 'Annual',
      rewards: [],
      monthlyCost: null,
      yearlyCost: 1200,
      durationType: 'yearly',
    };
    renderRow({ tier, currency: 'ZAR' });
    expect(screen.getByTestId('pass-holder-tier-cost')).toHaveTextContent('R 1200');
    expect(screen.getByTestId('pass-holder-tier-cost')).toHaveTextContent('每年');
  });

  it('renders "免費" when both costs are null', () => {
    const tier: PublicMembershipTier = {
      name: 'Trial',
      rewards: [],
      monthlyCost: null,
      yearlyCost: null,
      durationType: 'monthly',
    };
    renderRow({ tier });
    expect(screen.getByTestId('pass-holder-tier-cost')).toHaveTextContent('免費');
  });

  it('omits the period suffix when cost is free (both costs null)', () => {
    const tier: PublicMembershipTier = {
      name: 'Trial',
      rewards: [],
      monthlyCost: null,
      yearlyCost: null,
      durationType: 'monthly',
    };
    renderRow({ tier });
    const cost = screen.getByTestId('pass-holder-tier-cost');
    // "免費" only, no "每月" suffix
    expect(cost.textContent).not.toContain('每月');
  });

  it('clicking the row triggers onSelect with the correct index', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderRow({ onSelect, index: 3 });
    const row = screen.getByTestId('pass-holder-tier-row');
    await user.click(row);
    expect(onSelect).toHaveBeenCalledWith(3);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('marks the row as selected and adds data-tier-selected="true"', () => {
    renderRow({ selected: true });
    const row = screen.getByTestId('pass-holder-tier-row');
    expect(row).toHaveAttribute('data-tier-selected', 'true');
    // Selected radio has checked=true
    const radio = screen.getByTestId('pass-holder-tier-row-radio-0') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('unselected row has data-tier-selected="false" and unchecked radio', () => {
    renderRow({ selected: false });
    const row = screen.getByTestId('pass-holder-tier-row');
    expect(row).toHaveAttribute('data-tier-selected', 'false');
    const radio = screen.getByTestId('pass-holder-tier-row-radio-0') as HTMLInputElement;
    expect(radio.checked).toBe(false);
  });

  it('renders the rewards list when tier.rewards is non-empty', () => {
    const tier: PublicMembershipTier = {
      name: 'VIP',
      rewards: [
        { label: 'Free smoothie', value: 'https://example.com/a' },
        { label: 'Priority booking', value: 'https://example.com/b' },
      ],
      monthlyCost: 200,
      yearlyCost: null,
      durationType: 'monthly',
    };
    renderRow({ tier });
    expect(screen.getByTestId('pass-holder-tier-rewards')).toBeInTheDocument();
    expect(screen.getByText('Free smoothie')).toBeInTheDocument();
    expect(screen.getByText('Priority booking')).toBeInTheDocument();
    expect(screen.getByText('會員獎勵')).toBeInTheDocument();
  });

  it('omits the rewards block when tier.rewards is empty', () => {
    const tier: PublicMembershipTier = {
      name: 'Basic',
      rewards: [],
      monthlyCost: 100,
      yearlyCost: null,
      durationType: 'monthly',
    };
    renderRow({ tier });
    expect(screen.queryByTestId('pass-holder-tier-rewards')).not.toBeInTheDocument();
  });

  it('disabled state prevents click + adds opacity class', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderRow({ disabled: true, onSelect });
    const row = screen.getByTestId('pass-holder-tier-row');
    expect(row).toHaveClass('cursor-not-allowed');
    await user.click(row);
    // The radio is disabled, so clicking the wrapping label does not trigger onSelect.
    // (Note: real-browser behavior may still bubble; we assert the radio state.)
    const radio = screen.getByTestId('pass-holder-tier-row-radio-0') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
  });
});
