/**
 * PassHolderMembershipTiers tests — main assembly component. Covers
 * conditional rendering (isPaid + membershipTiers), Radio Card list
 * length, payment button provider switch by currency.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderMembershipTiers } from './PassHolderMembershipTiers';
import type { PublicPassTemplate, PublicMembershipTier } from '@saome/shared/types/passHolder';

const baseTiers: ReadonlyArray<PublicMembershipTier> = [
  {
    name: 'Basic',
    rewards: [{ label: '10% off drinks', value: 'https://example.com/basic' }],
    monthlyCost: 100,
    yearlyCost: null,
    durationType: 'monthly',
  },
  {
    name: 'VIP',
    rewards: [
      { label: 'Free smoothie', value: 'https://example.com/vip' },
      { label: 'Priority booking', value: 'https://example.com/booking' },
    ],
    monthlyCost: 200,
    yearlyCost: null,
    durationType: 'monthly',
  },
];

const baseTemplate: PublicPassTemplate = {
  id: 'demo-gym',
  name: 'FitClub Membership',
  cardType: 'membership_card',
  logoText: 'FitClub',
  issuerName: 'FitClub Taiwan',
  language: 'en',
  isPaid: true,
  currency: 'TWD',
  membershipTiers: baseTiers,
};

const renderTiers = (
  props: Partial<React.ComponentProps<typeof PassHolderMembershipTiers>> = {},
) =>
  render(
    <I18nextProvider i18n={testI18n}>
      <PassHolderMembershipTiers
        template={baseTemplate}
        selectedTierIndex={null}
        onSelectTier={vi.fn()}
        paymentState="idle"
        onSimulatePayment={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );

describe('PassHolderMembershipTiers', () => {
  it('renders the section header + tier list + payment button', () => {
    renderTiers();
    expect(screen.getByTestId('pass-holder-membership-tiers')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-tier-list')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-payment-button')).toBeInTheDocument();
    expect(screen.getAllByTestId('pass-holder-tier-row')).toHaveLength(2);
  });

  it('uses Ecpay (TWD) by default and Payfast for ZAR currency', () => {
    const { rerender } = renderTiers({ template: { ...baseTemplate, currency: 'TWD' } });
    expect(screen.getByTestId('pass-holder-payment-button')).toHaveAttribute('data-provider', 'ecpay');

    rerender(
      <I18nextProvider i18n={testI18n}>
        <PassHolderMembershipTiers
          template={{ ...baseTemplate, currency: 'ZAR' }}
          selectedTierIndex={null}
          onSelectTier={vi.fn()}
          paymentState="idle"
          onSimulatePayment={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('pass-holder-payment-button')).toHaveAttribute('data-provider', 'payfast');
  });

  it('clicking a tier row calls onSelectTier with the right index', async () => {
    const onSelectTier = vi.fn();
    const user = userEvent.setup();
    renderTiers({ onSelectTier });
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    await user.click(rows[1]!);
    expect(onSelectTier).toHaveBeenCalledWith(1);
  });

  it('selected tier reflects selectedTierIndex prop', () => {
    renderTiers({ selectedTierIndex: 1 });
    const rows = screen.getAllByTestId('pass-holder-tier-row');
    expect(rows[0]).toHaveAttribute('data-tier-selected', 'false');
    expect(rows[1]).toHaveAttribute('data-tier-selected', 'true');
  });

  it('clicking the payment button calls onSimulatePayment', async () => {
    const onSimulatePayment = vi.fn();
    const user = userEvent.setup();
    renderTiers({ selectedTierIndex: 0, onSimulatePayment });
    const button = screen.getByTestId('pass-holder-payment-button');
    // Disabled until a tier is selected
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onSimulatePayment).toHaveBeenCalledTimes(1);
  });

  it('payment button is disabled when no tier is selected', () => {
    renderTiers({ selectedTierIndex: null });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
  });

  it('payment button stays disabled when paymentState="paying"', () => {
    renderTiers({ selectedTierIndex: 0, paymentState: 'paying' });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-payment-state', 'paying');
  });

  it('payment button shows "已付款" when paymentState="paid"', () => {
    renderTiers({ selectedTierIndex: 0, paymentState: 'paid' });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('已付款');
  });

  it('renders nothing when membershipTiers is empty array', () => {
    const { container } = renderTiers({
      template: { ...baseTemplate, membershipTiers: [] },
    });
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when membershipTiers is undefined', () => {
    const { container } = renderTiers({
      template: { ...baseTemplate, membershipTiers: undefined },
    });
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  // ========================================================================
  // 2026-10-16 — CTA shows amount + action (3-branch idle label)
  // ========================================================================
  // User must know what they pay and what they get BEFORE clicking.
  // Three deterministic branches:
  //   1. selectedTier + cost > 0    → "支付 NT$ 200 並領取 Pass"
  //   2. selectedTier + cost === null → "免費領取 Pass"
  //   3. no selected tier           → fallback "以綠界付款" / "以 Payfast 付款"
  // Branch order is locked; future invariant — see feedback 20261016.

  it('paid tier selected (cost > 0): CTA shows "支付 NT$ 200 並領取 Pass"', () => {
    renderTiers({ selectedTierIndex: 1 }); // VIP tier, monthlyCost=200, TWD
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent(
      '支付 NT$ 200 並領取 Pass',
    );
  });

  it('ZAR currency: CTA shows "支付 R 100 並領取 Pass" (currency-aware symbol)', () => {
    const zarTiers: ReadonlyArray<PublicMembershipTier> = [
      {
        name: 'Basic',
        rewards: [{ label: '10% off', value: 'https://example.com/basic' }],
        monthlyCost: 100,
        yearlyCost: null,
        durationType: 'monthly',
      },
    ];
    renderTiers({
      selectedTierIndex: 0,
      template: { ...baseTemplate, currency: 'ZAR', membershipTiers: zarTiers },
    });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent(
      '支付 R 100 並領取 Pass',
    );
  });

  it('free tier selected (cost === null): CTA shows "免費領取 Pass"', () => {
    const freeTiers: ReadonlyArray<PublicMembershipTier> = [
      {
        name: 'Trial',
        rewards: [],
        monthlyCost: null,
        yearlyCost: null,
        durationType: 'monthly',
      },
    ];
    renderTiers({
      selectedTierIndex: 0,
      template: { ...baseTemplate, membershipTiers: freeTiers },
    });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent(
      '免費領取 Pass',
    );
  });

  it('no tier selected: CTA falls back to provider-specific "以綠界付款"', () => {
    renderTiers({ selectedTierIndex: null });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent(
      '以綠界付款',
    );
  });

  it('no tier selected + ZAR currency: CTA falls back to "以 Payfast 付款"', () => {
    renderTiers({
      selectedTierIndex: null,
      template: { ...baseTemplate, currency: 'ZAR' },
    });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent(
      '以 Payfast 付款',
    );
  });
});
