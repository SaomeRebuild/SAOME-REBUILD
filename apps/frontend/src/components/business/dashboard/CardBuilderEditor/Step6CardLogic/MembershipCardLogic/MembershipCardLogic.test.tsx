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
  // ===== 2026-09-14 free-card refactor =====
  // Previously: `isPaid=false` rendered only the "free state" empty hint.
  // Now: it renders a full editor (MembershipCardLogicFreeState) with
  // membership tier name + hasExpiry toggle + (optional) expiry mode +
  // custom-days / specific-date input + member rewards sub-rows.
  it('renders free-card full editor when isPaid=false (regression — 2026-09-14)', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      // setIsPaid(false) auto-seeds membershipTiers[0] — verify the seed.
      membershipTiers: [
        {
          id: 'free-tier-1',
          name: '',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: null,
          rewards: [],
        },
      ],
    });
    render(<MembershipCardLogic showValidation={false} />);

    // 免費卡仍顯示會員等級輸入框（綁定 membershipTiers[0].name）
    expect(
      screen.getByLabelText('step6.membership.tier.nameTitle'),
    ).toBeInTheDocument();
    // hasExpiry toggle 現在於 FreeState 內也顯示（不再是 empty state）
    expect(screen.getByRole('switch')).toBeInTheDocument();
    // 會員獎勵 sub-rows 區塊顯示
    expect(
      screen.getByText('step6.membership.rewardsTitle'),
    ).toBeInTheDocument();
    // "免費會員卡無需付費設定" empty hint 不再出現
    expect(
      screen.queryByText('step6.membership.freeStateTitle'),
    ).toBeNull();
  });

  it('isPaid=false + hasExpiry=false: does NOT render MembershipExpiryModeField', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      hasExpiry: false,
      membershipTiers: [
        {
          id: 'free-tier-1',
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

    // hasExpiry=false → expiry mode selector 不渲染
    expect(
      screen.queryByLabelText(
        'step6.membership.freeExpiryModeTitle',
      ),
    ).toBeNull();
    // custom days / specific date fields 也不渲染
    expect(
      screen.queryByLabelText(
        'step6.membership.freeCustomExpiryDaysTitle',
      ),
    ).toBeNull();
    expect(
      screen.queryByLabelText(
        'step6.membership.freeSpecificExpiryDateTitle',
      ),
    ).toBeNull();
  });

  it('isPaid=false + hasExpiry=true + custom_days: renders custom days field, NOT specific date field', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      hasExpiry: true,
      membershipExpiryMode: 'custom_days',
      membershipCustomExpiryDays: 100,
      membershipSpecificExpiryDate: null,
      membershipTiers: [
        {
          id: 'free-tier-1',
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

    // hasExpiry=true + custom_days → custom days field 渲染
    expect(
      screen.getByLabelText(
        'step6.membership.freeCustomExpiryDaysTitle',
      ),
    ).toBeInTheDocument();
    // specific date field 不渲染
    expect(
      screen.queryByLabelText(
        'step6.membership.freeSpecificExpiryDateTitle',
      ),
    ).toBeNull();
  });

  it('isPaid=false + hasExpiry=true + specific_date: renders specific date field, NOT custom days field', () => {
    useCardBuilderStore.setState({
      isPaid: false,
      hasExpiry: true,
      membershipExpiryMode: 'specific_date',
      membershipCustomExpiryDays: null,
      membershipSpecificExpiryDate: '2026-12-31',
      membershipTiers: [
        {
          id: 'free-tier-1',
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

    // specific date field 渲染
    expect(
      screen.getByLabelText(
        'step6.membership.freeSpecificExpiryDateTitle',
      ),
    ).toBeInTheDocument();
    // custom days field 不渲染
    expect(
      screen.queryByLabelText(
        'step6.membership.freeCustomExpiryDaysTitle',
      ),
    ).toBeNull();
  });

  it('isPaid=false: does NOT render "remove tier" button (no MembershipTierRow)', () => {
    // 2026-09-14: free-state 不渲染 MembershipTierRow，因此也不會有 "移除" 按鈕。
    useCardBuilderStore.setState({
      isPaid: false,
      membershipTiers: [
        {
          id: 'free-tier-1',
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

    // "移除" tier button 來自 MembershipTierRow，free state 不渲染
    expect(screen.queryByText('step6.membership.removeTier')).toBeNull();
  });

  // ===== 2026-09-14 defensive: FreeState empty-fallback =====
  // When isPaid=false but membershipTiers is empty (e.g. legacy data
  // without auto-seed, or test calling raw setState({isPaid: false})
  // without going through setIsPaid action), FreeState renders an
  // empty-fallback section that shows ONLY `freeStateHint` (NOT
  // `freeStateTitle` — the title was removed because it implied "no
  // need to configure", which is no longer accurate post-refactor).
  it('FreeState empty-fallback when isPaid=false + no tier seeded (defensive — 2026-09-14)', () => {
    useCardBuilderStore.setState({ isPaid: false, membershipTiers: [] });
    render(<MembershipCardLogic showValidation={false} />);

    // Empty-fallback section shows the hint, NOT the legacy empty-state title.
    expect(
      screen.getByText('step6.membership.freeStateHint'),
    ).toBeInTheDocument();
    // The editor title (which appears in the full-editor path) is NOT shown.
    expect(
      screen.queryByText('step6.membership.freeTierNameTitle'),
    ).toBeNull();
    // HasExpiry toggle MUST NOT render in empty-fallback path (no tier to bind).
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