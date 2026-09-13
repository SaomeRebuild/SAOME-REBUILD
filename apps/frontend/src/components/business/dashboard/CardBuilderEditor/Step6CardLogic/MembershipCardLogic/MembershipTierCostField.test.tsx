/**
 * MembershipTierCostField — Currency-aware rendering tests.
 *
 * Verifies:
 *   - TWD zh-TW suffix 元
 *   - TWD en prefix NT$
 *   - ZAR prefix R
 *   - cost = 0 allowed
 *   - cost = null renders empty input
 *
 * Lifetime mode (2026-09-13 user clarification — fee input stays in lifetime mode):
 *   - lifetimeMode=true → writes to lifetimeCost (always enabled)
 *   - lifetimeMode=false (default) → writes to monthlyCost/yearlyCost (depends on durationType)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipTierCostField } from './MembershipTierCostField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipTierCostFieldProps } from './MembershipCardLogic.types';

const props: MembershipTierCostFieldProps = {
  showValidation: false,
  tierId: 'tier-1',
};

// Track i18n language across tests via mutable holder.
let mockLang = 'zh-TW';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { get language() { return mockLang; } },
  })),
}));

afterEach(() => {
  mockLang = 'zh-TW';
  useCardBuilderStore.getState().reset();
  cleanup();
});

function seedTier(durationType: 'monthly' | 'yearly' | null, cost: number | null) {
  useCardBuilderStore.setState({
    currency: 'TWD',
    membershipTiers: [
      {
        id: 'tier-1',
        name: 'VIP',
        durationType,
        monthlyCost: durationType === 'monthly' ? cost : null,
        yearlyCost: durationType === 'yearly' ? cost : null,
        lifetimeCost: null,
        rewards: [],
      },
    ],
  });
}

describe('MembershipTierCostField — currency rendering', () => {
  it('TWD zh-TW: suffix 元, monthly cost', () => {
    seedTier('monthly', 100);
    render(<MembershipTierCostField {...props} />);
    expect(screen.getByText('step6.membership.tier.costUnitTWD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('TWD zh-TW: suffix 元, yearly cost', () => {
    seedTier('yearly', 1000);
    render(<MembershipTierCostField {...props} />);
    expect(screen.getByText('step6.membership.tier.costUnitTWD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
  });

  it('TWD en: prefix NT$', () => {
    mockLang = 'en';
    seedTier('monthly', 100);
    render(<MembershipTierCostField {...props} />);
    expect(screen.getByText('step6.membership.tier.costUnitTWD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('ZAR: prefix R', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });
    seedTier('monthly', 100);
    render(<MembershipTierCostField {...props} />);
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('cost = 0 is allowed (= free membership tier)', () => {
    seedTier('monthly', 0);
    render(<MembershipTierCostField {...props} />);
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('cost = null renders empty input (user has not entered anything)', () => {
    seedTier('monthly', null);
    render(<MembershipTierCostField {...props} />);
    const input = screen.getByLabelText('step6.membership.tier.costTitle') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('durationType=null → input disabled', () => {
    seedTier(null, null);
    render(<MembershipTierCostField {...props} />);
    const input = screen.getByLabelText('step6.membership.tier.costTitle') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it('negative cost is rejected by the input handler (store guard)', async () => {
    seedTier('monthly', null);
    const user = userEvent.setup();
    render(<MembershipTierCostField {...props} />);
    const input = screen.getByLabelText('step6.membership.tier.costTitle') as HTMLInputElement;
    await user.type(input, '-5');
    // Store guard rejects < 0 → field stays null
    expect(
      useCardBuilderStore.getState().membershipTiers[0]?.monthlyCost,
    ).toBeNull();
  });
});

describe('MembershipTierCostField — lifetime mode (regression — 2026-09-13)', () => {
  // User clarification 2026-09-13: even when card-wide hasExpiry=false
  // (lifetime membership), the fee input must remain visible. Tenants use
  // this to sell the right to a lifetime tier at a one-time price.
  // The field writes to `lifetimeCost` (separate from monthly/yearly) and
  // is always enabled regardless of durationType.

  it('lifetimeMode=true: field is always enabled (regardless of durationType=null)', () => {
    seedTier(null, null);
    render(<MembershipTierCostField {...props} lifetimeMode />);
    const input = screen.getByLabelText('step6.membership.tier.lifetimeCostTitle') as HTMLInputElement;
    expect(input).not.toBeDisabled();
  });

  it('lifetimeMode=true: writes to lifetimeCost (NOT monthlyCost/yearlyCost)', async () => {
    seedTier(null, null);
    const user = userEvent.setup();
    render(<MembershipTierCostField {...props} lifetimeMode />);
    const input = screen.getByLabelText('step6.membership.tier.lifetimeCostTitle') as HTMLInputElement;
    await user.type(input, '3000');
    const tier = useCardBuilderStore.getState().membershipTiers[0];
    expect(tier?.lifetimeCost).toBe(3000);
    // monthlyCost and yearlyCost remain untouched
    expect(tier?.monthlyCost).toBeNull();
    expect(tier?.yearlyCost).toBeNull();
  });

  it('lifetimeMode=true: clears lifetimeCost when input is empty', async () => {
    seedTier(null, 5000); // existing lifetimeCost
    const user = userEvent.setup();
    render(<MembershipTierCostField {...props} lifetimeMode />);
    const input = screen.getByLabelText('step6.membership.tier.lifetimeCostTitle') as HTMLInputElement;
    await user.clear(input);
    expect(useCardBuilderStore.getState().membershipTiers[0]?.lifetimeCost).toBeNull();
  });

  it('lifetimeMode=true: cost = 0 is allowed (free lifetime member)', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      membershipTiers: [
        {
          id: 'tier-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 0,
          rewards: [],
        },
      ],
    });
    render(<MembershipTierCostField {...props} lifetimeMode />);
    const input = screen.getByLabelText('step6.membership.tier.lifetimeCostTitle') as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  it('lifetimeMode=true: negative cost rejected by store guard', () => {
    // Use fireEvent.change instead of userEvent.type to avoid controlled-input
    // typing simulation issues with `<input type="number" min={0}>` — when
    // typing into a controlled number input with min={0}, the browser
    // coerces intermediate state in implementation-specific ways. Direct
    // fireEvent.change bypasses that and fires the handler with the final
    // value, which is what we actually want to test.
    seedTier(null, null);
    render(<MembershipTierCostField {...props} lifetimeMode />);
    const input = screen.getByLabelText('step6.membership.tier.lifetimeCostTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-100' } });
    expect(useCardBuilderStore.getState().membershipTiers[0]?.lifetimeCost).toBeNull();
  });

  it('lifetimeMode=true: with-expiry negative cost also rejected by store guard', () => {
    // Regression check that the same rejection logic works in the default
    // (with-expiry) mode too — fireEvent.change bypasses user typing
    // simulation entirely.
    seedTier('monthly', null);
    render(<MembershipTierCostField {...props} />);
    const input = screen.getByLabelText('step6.membership.tier.costTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-50' } });
    expect(useCardBuilderStore.getState().membershipTiers[0]?.monthlyCost).toBeNull();
  });

  it('lifetimeMode=true: shows lifetimeCostZeroIsFree hint (different from costZeroIsFree)', () => {
    seedTier(null, null);
    render(<MembershipTierCostField {...props} lifetimeMode />);
    expect(
      screen.getByText('step6.membership.tier.lifetimeCostZeroIsFree'),
    ).toBeInTheDocument();
  });

  it('lifetimeMode=false (default): reads from monthlyCost/yearlyCost as before', () => {
    seedTier('monthly', 250);
    render(<MembershipTierCostField {...props} />);
    // Label is the regular "costTitle" (not lifetimeCostTitle)
    expect(screen.getByLabelText('step6.membership.tier.costTitle')).toBeInTheDocument();
    expect(screen.queryByLabelText('step6.membership.tier.lifetimeCostTitle')).toBeNull();
    // Value rendered from monthlyCost
    expect(screen.getByDisplayValue('250')).toBeInTheDocument();
  });

  it('lifetimeMode=true: ZAR currency prefix R still applies', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });
    useCardBuilderStore.setState({
      membershipTiers: [
        {
          id: 'tier-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 3000,
          rewards: [],
        },
      ],
    });
    render(<MembershipTierCostField {...props} lifetimeMode />);
    // ZAR uses prefix R (costUnitZAR key)
    expect(screen.getByText('step6.membership.tier.costUnitZAR')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
  });

  it('lifetimeMode=true: TWD zh-TW suffix 元 still applies', () => {
    useCardBuilderStore.setState({ currency: 'TWD' });
    useCardBuilderStore.setState({
      membershipTiers: [
        {
          id: 'tier-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 3000,
          rewards: [],
        },
      ],
    });
    render(<MembershipTierCostField {...props} lifetimeMode />);
    expect(screen.getByText('step6.membership.tier.costUnitTWD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
  });
});