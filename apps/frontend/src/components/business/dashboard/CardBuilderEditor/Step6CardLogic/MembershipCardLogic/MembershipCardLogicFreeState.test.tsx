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

  it('membershipTiers.length=0: renders empty-fallback section (defensive — should be unreachable after 2026-09-18 fix)', () => {
    // 2026-09-18 fix: initialState now seeds `default-membership-tier` so
    // `MembershipCardLogicFreeState` always has a tier to bind to in normal
    // flows. This test now verifies only the defensive contract — if a
    // test or future code path bypasses the invariant (e.g. manually
    // setState'd an empty array), FreeState must still render the hint
    // gracefully instead of crashing. In production this branch is
    // unreachable; a `console.warn` fires to surface the regression.
    //
    // Silence the warn so the test output stays clean — we expect it.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    // The defensive fallback must surface a warning when it fires.
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // ====================================================================
  // 2026-09-18 regression: first-visit fallback
  // --------------------------------------------------------------------
  // Before this fix: fresh card with isPaid=false (default) had
  // membershipTiers=[] in initialState. FreeState would fall through to
  // the defensive `freeStateHint` section because membershipTiers[0] was
  // undefined. Only after the user toggled paid → unpaid did the
  // setIsPaid(false) setter's seed logic kick in and the editor finally
  // rendered.
  //
  // Fix: seed `default-membership-tier` in initialState + loadSettings
  // defensive seed + console.warn in fallback.
  // ====================================================================

  it('first-visit: reset() leaves initialState with isPaid=false + 1 seed tier; FreeState renders full editor', () => {
    // Fresh card: just reset, do NOT call setIsPaid or setState.
    useCardBuilderStore.getState().reset();

    // initialState invariant: even though isPaid=false, membershipTiers
    // already has 1 seed tier (default-membership-tier).
    const state = useCardBuilderStore.getState();
    expect(state.isPaid).toBe(false);
    expect(state.membershipTiers).toHaveLength(1);
    expect(state.membershipTiers[0].id).toBe('default-membership-tier');

    // Render and verify the FULL editor is present (NOT the fallback).
    render(<MembershipCardLogicFreeState showValidation={false} />);

    expect(
      screen.getByText('step6.membership.freeTierNameTitle'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('step6.membership.freeStateHint'),
    ).toBeNull();
  });

  it('idempotent: setIsPaid(true) then setIsPaid(false) does NOT double-seed membershipTiers', () => {
    // After the 2026-09-18 fix, initialState already seeds 1 tier.
    // Toggling paid → unpaid should NOT add a second tier (would corrupt
    // the implicit-single-tier contract that FreeState assumes).
    useCardBuilderStore.getState().reset();
    expect(useCardBuilderStore.getState().membershipTiers).toHaveLength(1);

    useCardBuilderStore.getState().setIsPaid(true);
    expect(useCardBuilderStore.getState().isPaid).toBe(true);

    useCardBuilderStore.getState().setIsPaid(false);
    const tiers = useCardBuilderStore.getState().membershipTiers;
    expect(tiers).toHaveLength(1);
    expect(tiers[0].id).toBe('default-membership-tier');
  });

  it('loadSettings with isPaid=false + empty tiers auto-seeds default tier (legacy DB row)', () => {
    // Simulate a legacy DB row: settings says isPaid=false but
    // membershipTiers=[] (e.g. saved before the free-card editor existed,
    // or a corrupted payload). The store's loadSettings should auto-seed
    // a default tier so FreeState has something to bind to.
    useCardBuilderStore.setState({ isPaid: false });

    useCardBuilderStore.getState().loadSettings({
      isPaid: false,
      membershipTiers: [],
    });

    const tiers = useCardBuilderStore.getState().membershipTiers;
    expect(tiers.length).toBeGreaterThanOrEqual(1);
    expect(tiers[0].id).toBe('default-membership-tier');
  });
});
