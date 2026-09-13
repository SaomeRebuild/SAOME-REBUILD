/**
 * MembershipHasExpiryToggle — Toggle behavior tests.
 *
 * Verifies:
 *   - Sets aria-checked based on store.hasExpiry
 *   - Click toggles store.hasExpiry
 *   - Toggling false → true does NOT clear tier fields (no field reset on ON)
 *   - Toggling true → false ONLY clears per-tier `durationType` (2026-09-13
 *     user clarification: even when "no expiry" is selected, the fee input
 *     must remain visible — tenants sell the right to a lifetime tier at a
 *     one-time price. The cost fields (monthlyCost / yearlyCost / lifetimeCost)
 *     are PRESERVED on the OFF toggle. The duration radio is hidden in
 *     lifetime mode but the user can re-toggle back to with-expiry without
 *     losing any cost values.)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipHasExpiryToggle } from './MembershipHasExpiryToggle';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { get language() { return 'zh-TW'; } },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MembershipHasExpiryToggle — toggle behavior', () => {
  it('renders toggle in unchecked state when hasExpiry=false (default)', () => {
    render(<MembershipHasExpiryToggle showValidation={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('renders toggle in checked state when hasExpiry=true', () => {
    useCardBuilderStore.setState({ hasExpiry: true });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('hasExpiry=true: button has bg-primary class, NOT bg-card (regression 2026-09-13)', () => {
    // Fix 6: ON state must have a visible primary background so the toggle
    // is unambiguously distinguishable from OFF. Previously the thumb track
    // was the only visual indicator — the button itself stayed bg-card,
    // which read as "no background" and obscured the label.
    useCardBuilderStore.setState({ hasExpiry: true });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.className).toContain('bg-primary');
    expect(toggle.className).not.toContain('bg-card');
  });

  it('hasExpiry=false: button has bg-card class, NOT bg-primary', () => {
    useCardBuilderStore.setState({ hasExpiry: false });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.className).toContain('bg-card');
    expect(toggle.className).not.toContain('bg-primary');
  });

  it('button no longer contains the thumb track / knob inner spans (regression 2026-09-13)', () => {
    // The toggle simplified to a single background-color swap. Verify that
    // the old thumb track / thumb knob are no longer rendered as children
    // of the switch button.
    useCardBuilderStore.setState({ hasExpiry: true });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    const toggle = screen.getByRole('switch');
    // The toggle button should contain only ONE inner <span> (the label)
    const innerSpans = toggle.querySelectorAll('span');
    expect(innerSpans.length).toBe(1);
    expect(innerSpans[0]?.textContent).toBe('step6.membership.hasExpiryOn');
  });

  it('click toggles hasExpiry from false → true (and does NOT clear tier fields)', () => {
    useCardBuilderStore.setState({
      hasExpiry: false,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 3000, // lifetime mode cost — must survive toggle to true
          rewards: [],
        },
      ],
    });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(useCardBuilderStore.getState().hasExpiry).toBe(true);
    // lifetimeCost preserved (toggle ON → field hidden by editor but data preserved)
    expect(
      useCardBuilderStore.getState().membershipTiers[0]?.lifetimeCost,
    ).toBe(3000);
    // durationType still null (no change)
    expect(
      useCardBuilderStore.getState().membershipTiers[0]?.durationType,
    ).toBeNull();
  });

  it('click toggles hasExpiry from true → false (clears durationType ONLY — costs preserved — regression 2026-09-13)', () => {
    // 2026-09-13 user clarification: when toggling to "no expiry" (lifetime),
    // the fee input must remain visible so tenants can sell the right to a
    // lifetime tier at a one-time price. Therefore `setHasExpiry(false)` now
    // ONLY clears per-tier `durationType` and PRESERVES all cost fields
    // (monthlyCost / yearlyCost / lifetimeCost). The editor hides the
    // duration radio + monthly/yearly in lifetime mode and renders the
    // lifetimeCost field instead.
    useCardBuilderStore.setState({
      hasExpiry: true,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: 'monthly',
          monthlyCost: 100,
          yearlyCost: 1000,
          lifetimeCost: null,
          rewards: [],
        },
        {
          id: 't-2',
          name: 'Gold',
          durationType: 'yearly',
          monthlyCost: 50,
          yearlyCost: 500,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(useCardBuilderStore.getState().hasExpiry).toBe(false);
    // All tiers have their durationType cleared (so the radio un-checks)
    const tiers = useCardBuilderStore.getState().membershipTiers;
    for (const tier of tiers) {
      expect(tier.durationType).toBeNull();
    }
    // Cost fields (monthlyCost / yearlyCost) are PRESERVED so the user
    // can re-toggle back to with-expiry without losing data.
    expect(tiers[0]?.monthlyCost).toBe(100);
    expect(tiers[0]?.yearlyCost).toBe(1000);
    expect(tiers[1]?.monthlyCost).toBe(50);
    expect(tiers[1]?.yearlyCost).toBe(500);
  });

  it('lifetimeCost field is preserved across toggle true → false (regression — 2026-09-13)', () => {
    // The lifetimeCost field was added in 2026-09-13. It should never be
    // cleared by setHasExpiry() — neither on true nor false. The user may
    // enter a lifetimeCost value, toggle back to with-expiry (where the
    // field is hidden), and toggle back to lifetime mode without losing
    // their input.
    useCardBuilderStore.setState({
      hasExpiry: true,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 5000,
          rewards: [],
        },
      ],
    });
    render(<MembershipHasExpiryToggle showValidation={false} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(useCardBuilderStore.getState().hasExpiry).toBe(false);
    // lifetimeCost must survive the toggle
    expect(
      useCardBuilderStore.getState().membershipTiers[0]?.lifetimeCost,
    ).toBe(5000);
    expect(
      useCardBuilderStore.getState().membershipTiers[0]?.durationType,
    ).toBeNull();
  });
});