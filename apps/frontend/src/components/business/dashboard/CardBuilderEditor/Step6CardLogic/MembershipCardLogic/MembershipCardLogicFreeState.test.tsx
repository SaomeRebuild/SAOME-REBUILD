/**
 * MembershipCardLogicFreeState — Full editor for free membership card (2026-09-14).
 *
 * Verifies the complete free-card editor wiring:
 *   - Renders tier name input bound to membershipTiers[0].name
 *   - Renders HasExpiry toggle (now part of the free-card editor)
 *   - Renders member rewards sub-rows bound to membershipTiers[0].id
 *   - Conditional rendering of expiry mode + custom-days / specific-date fields
 *   - Does NOT render "remove tier" button
 *
 * Note: tier-specific fields like `updateMembershipTier` / `addMembershipTierReward`
 * are tested via the parent `MembershipCardLogic` test file. This file focuses
 * on the FreeState layout + conditional rendering contract.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipCardLogicFreeState } from './MembershipCardLogicFreeState';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

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

const FREE_TIER = {
  id: 'free-tier-1',
  name: '',
  durationType: null,
  monthlyCost: null,
  yearlyCost: null,
  lifetimeCost: null,
  rewards: [],
};

describe('MembershipCardLogicFreeState — full editor for free membership card (2026-09-14)', () => {
  it('renders the tier name section header', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByText('step6.membership.freeTierNameTitle'),
    ).toBeInTheDocument();
  });

  it('renders MembershipTierNameField bound to membershipTiers[0]', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [{ ...FREE_TIER, name: 'VIP' }],
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    // MembershipTierNameField has aria-label = "step6.membership.tier.nameTitle"
    const nameInput = screen.getByLabelText(
      'step6.membership.tier.nameTitle',
    );
    expect((nameInput as HTMLInputElement).value).toBe('VIP');
  });

  it('renders HasExpiry toggle (free card uses hasExpiryOnFree label)', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
      hasExpiry: true,
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    const toggle = screen.getByRole('switch');
    expect(toggle.textContent).toBe('step6.membership.hasExpiryOnFree');
  });

  it('hasExpiry=false: does NOT render MembershipExpiryModeField', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
      hasExpiry: false,
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.queryByLabelText('step6.membership.freeExpiryModeTitle'),
    ).toBeNull();
  });

  it('hasExpiry=true: renders MembershipExpiryModeField (radio group)', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
      hasExpiry: true,
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByLabelText('step6.membership.freeExpiryModeTitle'),
    ).toBeInTheDocument();
  });

  it('hasExpiry=true + custom_days: renders CustomExpiryDaysField', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
      hasExpiry: true,
      membershipExpiryMode: 'custom_days',
      membershipCustomExpiryDays: 100,
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByLabelText(
        'step6.membership.freeCustomExpiryDaysTitle',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(
        'step6.membership.freeSpecificExpiryDateTitle',
      ),
    ).toBeNull();
  });

  it('hasExpiry=true + specific_date: renders SpecificExpiryDateField', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
      hasExpiry: true,
      membershipExpiryMode: 'specific_date',
      membershipSpecificExpiryDate: '2026-12-31',
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByLabelText(
        'step6.membership.freeSpecificExpiryDateTitle',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(
        'step6.membership.freeCustomExpiryDaysTitle',
      ),
    ).toBeNull();
  });

  it('renders MembershipTierRewardList bound to membershipTiers[0].id', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    // The reward list title is rendered.
    expect(
      screen.getByText('step6.membership.rewardsTitle'),
    ).toBeInTheDocument();
    // Empty state shown when no rewards yet.
    expect(
      screen.getByText('step6.membership.rewardsEmpty'),
    ).toBeInTheDocument();
    // Add reward button is rendered.
    expect(
      screen.getByText('step6.membership.addReward'),
    ).toBeInTheDocument();
  });

  it('does NOT render "remove tier" button (free card has implicit single tier)', () => {
    // 2026-09-14: FreeState does NOT render MembershipTierRow, so the
    // "移除" tier button is absent. The user cannot remove the implicit
    // single tier — switching isPaid back to true handles that.
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [FREE_TIER],
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(screen.queryByText('step6.membership.removeTier')).toBeNull();
  });

  it('membershipTiers.length=0: renders empty-fallback section (defensive)', () => {
    // Defensive: if for some reason setIsPaid(false) didn't auto-seed
    // (e.g. legacy data without auto-seed logic), FreeState falls back
    // to a hint section instead of crashing.
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [],
    });
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByText('step6.membership.freeStateHint'),
    ).toBeInTheDocument();
    // Editor sections NOT rendered.
    expect(
      screen.queryByText('step6.membership.freeTierNameTitle'),
    ).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
