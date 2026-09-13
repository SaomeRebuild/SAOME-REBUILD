/**
 * MembershipCardLogic — Vitest + RTL Tests (Rule 003 TDD + Rule 000 L2 結構)
 *
 * Verifies the main component routes between free / paid state and renders
 * the correct sub-components.
 *
 * Tests run 5 scenarios:
 *   1. isPaid=false → MembershipCardLogicFreeState rendered, no editor
 *   2. isPaid=true + no tiers → tierUnknown hint shown
 *   3. isPaid=true + 1 tier with valid data → row rendered
 *   4. isPaid=true + 5 tiers (cap reached) → maxTiersReached shown
 *   5. isPaid=true + hasExpiry=false → tier row shows lifetimeCost field
 *      (regression — 2026-09-13 user clarification: the fee input must
 *      remain visible in lifetime mode because tenants sell the right to
 *      a lifetime tier at a one-time price)
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipCardLogic } from './MembershipCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_MEMBERSHIP_TIERS } from '@saome/shared/constants';

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

describe('MembershipCardLogic — main component (Rule 000 § A.1)', () => {
  it('renders free state when isPaid=false (免費會員卡無需付費設定)', () => {
    useCardBuilderStore.setState({ isPaid: false });
    render(<MembershipCardLogic showValidation={false} />);

    expect(screen.getByText('step6.membership.freeStateTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.membership.freeStateHint')).toBeInTheDocument();
    // HasExpiry toggle MUST NOT render in free state
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('renders tier editor (hasExpiry toggle + tier list) when isPaid=true + no tiers', () => {
    useCardBuilderStore.setState({ isPaid: true, membershipTiers: [], hasExpiry: false });
    render(<MembershipCardLogic showValidation={false} />);

    // HasExpiry toggle renders
    expect(screen.getByRole('switch')).toBeInTheDocument();
    // Tier list header renders
    expect(screen.getByText('step6.membership.tiersTitle')).toBeInTheDocument();
    // Note: MembershipCardLogicPreview was removed on 2026-09-13 — no
    // preview section should be rendered alongside the tier editor.
    expect(
      screen.queryByText('step6.membership.preview.tierUnknown'),
    ).toBeNull();
  });

  it('does NOT render MembershipCardLogicPreview (regression 2026-09-13)', () => {
    // Fix 5: the live-preview section was removed in 2026-09-13 because
    // it was redundant with the card preview on the right panel and
    // obscured the tier editor. The pass-level preview is the source
    // of truth for tier info.
    useCardBuilderStore.setState({
      isPaid: true,
      hasExpiry: false,
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
    render(<MembershipCardLogic showValidation={false} />);

    // No "Live Preview" heading
    expect(screen.queryByText('step6.membership.preview.title')).toBeNull();
    // No preview placeholder
    expect(screen.queryByText('step6.membership.preview.tierUnknown')).toBeNull();
    // The "free state" message must NOT appear in paid mode
    expect(screen.queryByText('step6.membership.freeStateTitle')).toBeNull();
  });

  it('renders 1 tier row + add button when isPaid=true + 1 tier', () => {
    useCardBuilderStore.setState({
      isPaid: true,
      hasExpiry: false,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    });
    render(<MembershipCardLogic showValidation={false} />);

    // The tier name input should be present (label uses .tier.nameTitle —
    // both the row header span AND the field label render the same key,
    // so we assert presence by querying the input element directly).
    expect(screen.getByLabelText('step6.membership.tier.nameTitle')).toBeInTheDocument();
    // HasExpiry toggle is still rendered
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders maxTiersReached hint when at MAX_MEMBERSHIP_TIERS=5', () => {
    const tiers = Array.from({ length: MAX_MEMBERSHIP_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      durationType: null,
      monthlyCost: null,
      yearlyCost: null,
      lifetimeCost: null,
      rewards: [],
    }));
    useCardBuilderStore.setState({ isPaid: true, membershipTiers: tiers });
    render(<MembershipCardLogic showValidation={false} />);

    expect(
      screen.getByText('step6.membership.maxTiersReached'),
    ).toBeInTheDocument();
  });

  // ===== 2026-09-13 user clarification — fee input must stay visible in lifetime mode =====
  it('hasExpiry=false + 1 tier: renders lifetimeCost field (regression — 2026-09-13)', () => {
    // User clarified that even when "no expiry" is selected, the fee
    // input must remain visible. The cost field renders in lifetime mode
    // (writes to lifetimeCost instead of monthly/yearly).
    useCardBuilderStore.setState({
      isPaid: true,
      hasExpiry: false,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    });
    render(<MembershipCardLogic showValidation={false} />);

    // lifetimeCost label is rendered (lifetime mode)
    expect(
      screen.getByLabelText('step6.membership.tier.lifetimeCostTitle'),
    ).toBeInTheDocument();
    // The regular "costTitle" (monthly/yearly) is NOT rendered in lifetime mode
    expect(
      screen.queryByLabelText('step6.membership.tier.costTitle'),
    ).toBeNull();
  });

  it('hasExpiry=true + 1 tier: renders duration radio + cost field (regression — 2026-09-13)', () => {
    useCardBuilderStore.setState({
      isPaid: true,
      hasExpiry: true,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: 'monthly',
          monthlyCost: 100,
          yearlyCost: null,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    });
    render(<MembershipCardLogic showValidation={false} />);

    // In with-expiry mode, the regular "costTitle" field renders.
    expect(screen.getByLabelText('step6.membership.tier.costTitle')).toBeInTheDocument();
    // The lifetimeCost label is NOT rendered.
    expect(
      screen.queryByLabelText('step6.membership.tier.lifetimeCostTitle'),
    ).toBeNull();
  });
});