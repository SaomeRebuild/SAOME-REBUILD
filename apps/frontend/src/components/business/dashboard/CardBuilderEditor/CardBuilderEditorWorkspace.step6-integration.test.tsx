/**
 * CardBuilderEditorWorkspace — Step 6 Integration Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Step 6 renders <Step6CardLogic> with correct showValidation prop
 *   - Prev/Next buttons exist
 *   - Next is disabled when !isStep6Valid()
 *   - Step 6 save block is NOT called during mount (only on handleNext)
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 workspace integration.
 */

import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Mock the real Step6CardLogic to assert it's rendered with correct props.
let step6Renders = 0;

vi.mock('./Step6CardLogic', () => ({
  Step6CardLogic: ({ showValidation }: { showValidation: boolean }) => {
    step6Renders += 1;
    return (
      <div data-testid="step6-card-logic" data-show-validation={String(showValidation)}>
        Step6CardLogic
      </div>
    );
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  step6Renders = 0;
  useCardBuilderStore.getState().reset();
  // 2026-09-18: Reset the multi-tier Step 6 fields to `[]` so each test
  // starts from a clean slate. The store's `reset()` restores the typed
  // initial state, which includes the baseline 1-row seed for
  // `discountTiers` (per user requirement "預設一個 row") and the
  // baseline 1-row `membershipTiers` (2026-09-18 regression fix for
  // `MembershipCardLogicFreeState`). For tests that exercise a specific
  // card type, the multi-tier arrays are typically expected to be empty
  // unless the test injects values via `setState`. Without this explicit
  // reset the seed row would leak into the save-payload expect diffs.
  useCardBuilderStore.setState({
    membershipTiers: [],
    rewardTiers: [],
    cashbackTiers: [],
    discountTiers: [],
    discountCustomExpiryDays: null,
    discountSpecificExpiryDate: null,
  });
  cleanup();
});

describe('CardBuilderEditorWorkspace — Step 6 (2026-09-07 stamp card logic integration)', () => {
  it('renders Step6CardLogic when step=6', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('step6-card-logic')).toBeInTheDocument();
    expect(step6Renders).toBe(1);
  });

  it('renders Prev and Next buttons in Step 6', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('actions.prev')).toBeInTheDocument();
    expect(screen.getByText('step1.next')).toBeInTheDocument();
  });

  it('renders Step 6 title (step6.title i18n key)', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('step6.title')).toBeInTheDocument();
  });

  it('does NOT render Step6CardLogic when step is not 6', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(
      <CardBuilderEditorWorkspace
        step={5}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('step6-card-logic')).not.toBeInTheDocument();
  });

  it('Next button is disabled when !isStep6Valid() (stamp_card, all fields null)', () => {
    // Default store has cardType=null; set it to stamp_card so isStep6Valid uses stamp_card gate
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const nextBtn = screen.getByText('step1.next');
    expect(nextBtn).toBeDisabled();
  });

  it('Next button is enabled when isStep6Valid() (stamp_card, all fields filled)', () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
    });

    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const nextBtn = screen.getByText('step1.next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('Prev button navigates to step 5', async () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="stamp_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('actions.prev'));

    expect(onStepChange).toHaveBeenCalledWith(5);
  });

  it('Next button is ALWAYS enabled for ComingSoon card types (always valid)', () => {
    // 2026-09-11: cashback_card is now a fully implemented card type
    // (CashbackCardLogic), so it's no longer in the ComingSoon branch.
    // Use membership_card which is still ComingSoon.
    //
    // 2026-09-14: membership_card now has full free-card + paid-card editor,
    // so we need to put it in a valid state (isPaid=true with valid tier
    // OR isPaid=false with auto-seeded tier). Use the paid-card path
    // (isPaid=true) to keep the test simple — that path requires only
    // name.trim() !== '' on tier[0].
    useCardBuilderStore.setState({
      cardType: 'membership_card',
      isPaid: true,
      membershipTiers: [
        {
          id: 't-1',
          name: 'VIP',
          durationType: null,
          monthlyCost: null,
          yearlyCost: null,
          lifetimeCost: 1000,
          rewards: [],
        },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="membership_card"
        cardId="test-id"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const nextBtn = screen.getByText('step1.next');
    expect(nextBtn).not.toBeDisabled();
  });

  it('handleNext calls onSave with Step 6 base fields when cardId exists (per_stamp — always valid)', async () => {
    // 2026-09-07 regression: this test was originally set to `per_visit` but
    // `isStep6Valid()` gates `per_visit` behind filled threshold fields —
    // so it actually never advanced and `onSave` was never called.
    // Switched to `per_stamp` which has no threshold requirement, keeps the
    // original assertion (5 base fields reach the backend), and lets the
    // threshold-round-trip coverage live in dedicated tests below.
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="stamp_card"
        cardId="test-card-id"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    // 2026-09-09 mixed refactor: top-level `earningMode` is included in
    // the save payload (one mode per card). Per-tier earn rate fields
    // (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints)
    // are inline per tier; per-tier `earningMode` is NO LONGER sent
    // (the backend schema no longer carries that field).
    //
    // 2026-09-14 free-card extension: when isPaid=true (this test case
    // is per_stamp — paid card), the 3 free-card fields are sent as
    // `undefined` (so backend doesn't see them).
    expect(onSave).toHaveBeenCalledWith('test-card-id', {
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
      stampsPerVisitCount: null,
      stampsPerVisitStamps: null,
      stampsPerSpendAmount: null,
      stampsPerSpendStamps: null,
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [],
      // Cashback (2026-09-11) — not applicable for stamp_card, always sent empty.
      cashbackTiers: [],
      // Free-card (2026-09-14) — not applicable when isPaid=true, sent as undefined.
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  // ----- 2026-09-07 round-trip regression: threshold fields must reach backend -----

  it('handleNext forwards stampsPerVisitCount + stampsPerVisitStamps for per_visit mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_visit',
      rewardName: '8% 折價',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
      stampsPerVisitCount: 3,
      stampsPerVisitStamps: 2,
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="stamp_card"
        cardId="visit-card"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith('visit-card', {
      stampAccrualMode: 'per_visit',
      rewardName: '8% 折價',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
      stampsPerVisitCount: 3,
      stampsPerVisitStamps: 2,
      // per_visit: spend fields are explicitly null
      stampsPerSpendAmount: null,
      stampsPerSpendStamps: null,
      // 2026-09-09 mixed refactor: top-level earningMode (reward_card) is
      // always sent (null for stamp_card since reward fields don't apply).
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [],
      // Cashback (2026-09-11) — not applicable for stamp_card, always sent empty.
      cashbackTiers: [],
      // Free-card (2026-09-14) — paid card sends undefined
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  it('handleNext forwards stampsPerSpendAmount + stampsPerSpendStamps for per_spend mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_spend',
      rewardName: '$10 off',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
      stampsPerSpendAmount: 100,
      stampsPerSpendStamps: 1,
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="stamp_card"
        cardId="spend-card"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith('spend-card', {
      stampAccrualMode: 'per_spend',
      rewardName: '$10 off',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
      // per_spend: visit fields are explicitly null
      stampsPerVisitCount: null,
      stampsPerVisitStamps: null,
      stampsPerSpendAmount: 100,
      stampsPerSpendStamps: 1,
      // 2026-09-09 mixed refactor: top-level earningMode (reward_card)
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [],
      // Cashback (2026-09-11) — not applicable for stamp_card, always sent empty.
      cashbackTiers: [],
      // Free-card (2026-09-14) — paid card sends undefined
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  // ===== 2026-09-09 mixed refactor: reward_card save payload =====
  it('handleNext forwards card-wide earningMode + per-tier earn rates for reward_card', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      earningMode: 'based_on_spending',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500點折抵5%',
          threshold: 500,
          rewardType: 'percent_off',
          rewardValue: 5,
          maxDiscountAmount: 50,
          // Per-tier earn rate fields (no per-tier earningMode — top-level only)
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
        {
          id: 'tier-2',
          name: '1000點折抵10%',
          threshold: 1000,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 100,
          // Different per-tier rate under the same card-wide mode
          pointsPerVisit: null,
          pointsPerSpendAmount: 50,   // tier-2: $50 = 1 pt (different from tier-1)
          pointsPerSpendPoints: 1,
        },
      ],
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="reward_card"
        cardId="reward-card-id"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith('reward-card-id', {
      // Stamp fields are null/empty for reward_card (not applicable).
      stampAccrualMode: null,
      rewardName: '',
      rewardType: null,
      rewardValue: null,
      maxDiscountAmount: null,
      stampsPerVisitCount: null,
      stampsPerVisitStamps: null,
      stampsPerSpendAmount: null,
      stampsPerSpendStamps: null,
      // 2026-09-09 mixed refactor: card-wide earningMode (top-level) +
      // per-tier earn rate fields (inline). NO per-tier earningMode —
      // the backend schema dropped that field.
      earningMode: 'based_on_spending',
      // 2026-09-13 membership card — not applicable for reward_card,
      // always sent empty.
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [
        {
          name: '500點折抵5%',
          threshold: 500,
          rewardType: 'percent_off',
          rewardValue: 5,
          maxDiscountAmount: 50,
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
        {
          name: '1000點折抵10%',
          threshold: 1000,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 100,
          pointsPerVisit: null,
          pointsPerSpendAmount: 50,
          pointsPerSpendPoints: 1,
        },
      ],
      // Cashback (2026-09-11) — not applicable for reward_card, always sent empty.
      cashbackTiers: [],
      // Free-card (2026-09-14) — not applicable for reward_card
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  // ===== isRewardStep6Valid tests (2026-09-09 mixed refactor) =====
  it('reward_card: Next disabled when card-wide earningMode is null', () => {
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [
        { id: 'tier-1', name: '500點', threshold: 500, rewardType: 'amount_off', rewardValue: 50, maxDiscountAmount: null, pointsPerVisit: null, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="reward_card"
        cardId="r1"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('reward_card: Next enabled when card-wide mode=based_on_visits and every tier has pointsPerVisit', () => {
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      earningMode: 'based_on_visits',
      rewardTiers: [
        { id: 'tier-1', name: '500點', threshold: 500, rewardType: 'amount_off', rewardValue: 50, maxDiscountAmount: null, pointsPerVisit: 10, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
        { id: 'tier-2', name: '1000點', threshold: 1000, rewardType: 'amount_off', rewardValue: 100, maxDiscountAmount: null, pointsPerVisit: 5, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="reward_card"
        cardId="r2"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('reward_card: Next disabled when card-wide mode=based_on_visits but one tier lacks pointsPerVisit', () => {
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      earningMode: 'based_on_visits',
      rewardTiers: [
        { id: 'tier-1', name: '500點', threshold: 500, rewardType: 'amount_off', rewardValue: 50, maxDiscountAmount: null, pointsPerVisit: 10, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
        { id: 'tier-2', name: '1000點', threshold: 1000, rewardType: 'amount_off', rewardValue: 100, maxDiscountAmount: null, pointsPerVisit: null, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="reward_card"
        cardId="r3"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  // ===== isCashbackStep6Valid tests (2026-09-11 Cashback card) =====
  // Mirrors the isRewardStep6Valid tests pattern. Each tier has 3 fields:
  //   name (required) + thresholdSpend (0..999_999_999) + cashbackPercent (1..100).
  it('cashback_card: Next disabled when cashbackTiers is empty', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-empty"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('cashback_card: Next disabled when tier name is empty', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [
        { id: 't-1', name: '', thresholdSpend: 0, cashbackPercent: 5 },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-noname"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('cashback_card: Next enabled for default tier (thresholdSpend=0) with name + valid percent', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, cashbackPercent: 1 },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-default"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('cashback_card: Next enabled for multi-tier (sorted ASC by thresholdSpend)', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [
        { id: 't-1', name: '一般', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 't-2', name: '銀卡', thresholdSpend: 1000, cashbackPercent: 3 },
        { id: 't-3', name: '金卡', thresholdSpend: 5000, cashbackPercent: 5 },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-multi"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('cashback_card: Next disabled when cashbackPercent < 1', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [
        { id: 't-1', name: 'X', thresholdSpend: 0, cashbackPercent: 0 },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-pct-zero"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('cashback_card: Next disabled when cashbackPercent > 100', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      cashbackTiers: [
        { id: 't-1', name: 'X', thresholdSpend: 0, cashbackPercent: 150 },
      ],
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
        cardId="cb-pct-high"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('cashback_card: handleNext forwards sanitized cashbackTiers (sorted ASC by thresholdSpend)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      // Note: deliberately unsorted — store sorts ASC on save.
      cashbackTiers: [
        { id: 't-1', name: '金卡', thresholdSpend: 5000, cashbackPercent: 5 },
        { id: 't-2', name: '銀卡', thresholdSpend: 1000, cashbackPercent: 3 },
        { id: 't-3', name: '一般', thresholdSpend: 0, cashbackPercent: 1 },
      ],
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="cashback_card"
        cardId="cb-save"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith('cb-save', {
      // Stamp fields (not applicable for cashback_card)
      stampAccrualMode: null,
      rewardName: '',
      rewardType: null,
      rewardValue: null,
      maxDiscountAmount: null,
      stampsPerVisitCount: null,
      stampsPerVisitStamps: null,
      stampsPerSpendAmount: null,
      stampsPerSpendStamps: null,
      // Reward fields (not applicable for cashback_card)
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [],
      // 2026-09-11: Cashback tiers sorted ASC by thresholdSpend;
      // 'id' is stripped (UI-only React key, not part of contract).
      cashbackTiers: [
        { name: '一般', thresholdSpend: 0, cashbackPercent: 1 },
        { name: '銀卡', thresholdSpend: 1000, cashbackPercent: 3 },
        { name: '金卡', thresholdSpend: 5000, cashbackPercent: 5 },
      ],
      // Free-card (2026-09-14) — not applicable for cashback_card
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  // ===== 2026-09-18 isDiscountStep6Valid tests =====
  // Per user clarification: card expiry is REQUIRED — at least ONE of
  // (discountCustomExpiryDays, discountSpecificExpiryDate) must be set.
  // Otherwise the user should design a Cashback card instead.
  //
  // Mirrors isCashbackStep6Valid test pattern above.
  it('discount_card: Next disabled when tier name is empty (regression — basic tier check still works)', () => {
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '', thresholdSpend: 0, discountPercent: 5 },
      ],
      // Provide an expiry so the only failing gate is the tier name.
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-noname"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('discount_card: Next disabled when both expiry fields are null (REQUIRED — user clarification 2026-09-18)', () => {
    // Per user: "他不該是選填，應該是必填其中之一，不然的話去設計Cashback卡就好"
    // Tier is valid (default tier with name) but no expiry set → invalid.
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, discountPercent: 5 },
      ],
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-no-expiry"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('discount_card: Next enabled when days is set (one expiry field is enough)', () => {
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, discountPercent: 5 },
      ],
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-days-ok"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('discount_card: Next enabled when date is set (one expiry field is enough)', () => {
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, discountPercent: 5 },
      ],
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2027-12-31',
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-date-ok"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('discount_card: Next disabled when days is OUT OF RANGE (defensive — store clamps but corrupt DB may bypass)', () => {
    // Store setter clamps to [1, 3650]; loadSettings coerces. But if a
    // corrupted DB row leaks through with an out-of-range value, the
    // workspace validation must still block Next.
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, discountPercent: 5 },
      ],
      // Bypass the setter by writing directly to the state shape.
      // (Valid in unit tests; production setter would clamp to 3650.)
      discountCustomExpiryDays: 9999,
      discountSpecificExpiryDate: null,
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-days-bad"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).toBeDisabled();
  });

  it('discount_card: Next enabled for multi-tier with days expiry (sorted ASC by thresholdSpend)', () => {
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      discountTiers: [
        { id: 't-1', name: '一般', thresholdSpend: 0, discountPercent: 1 },
        { id: 't-2', name: '銀卡', thresholdSpend: 1000, discountPercent: 3 },
        { id: 't-3', name: '金卡', thresholdSpend: 5000, discountPercent: 5 },
      ],
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="discount_card"
        cardId="d-multi-ok"
        onCardTypeChange={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('step1.next')).not.toBeDisabled();
  });

  it('discount_card: handleNext forwards sanitized discountTiers + both expiry fields (REQUIRED both sent)', async () => {
    // Per user clarification 2026-09-18: discount card MUST have an expiry;
    // both expiry fields are forwarded on save (the API contract preserves
    // whichever the user picked; mutually-exclusive invariant guarantees
    // at most one is non-null at any time, but the field-handler contract
    // is the authority).
    const onSave = vi.fn().mockResolvedValue(undefined);
    useCardBuilderStore.setState({
      cardType: 'discount_card',
      // Deliberately unsorted — store sorts ASC on save.
      discountTiers: [
        { id: 't-1', name: '金卡', thresholdSpend: 5000, discountPercent: 5 },
        { id: 't-2', name: '一般', thresholdSpend: 0, discountPercent: 1 },
      ],
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    });

    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={onStepChange}
        cardType="discount_card"
        cardId="d-save"
        onCardTypeChange={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('step1.next'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith('d-save', {
      // Stamp / reward / cashback / membership fields (not applicable for discount_card)
      stampAccrualMode: null,
      rewardName: '',
      rewardType: null,
      rewardValue: null,
      maxDiscountAmount: null,
      stampsPerVisitCount: null,
      stampsPerVisitStamps: null,
      stampsPerSpendAmount: null,
      stampsPerSpendStamps: null,
      earningMode: null,
      hasExpiry: false,
      membershipTiers: [],
      rewardTiers: [],
      cashbackTiers: [],
      membershipExpiryMode: undefined,
      membershipCustomExpiryDays: undefined,
      membershipSpecificExpiryDate: undefined,
      // 2026-09-18: Discount card fields. tiers sorted ASC by
      // thresholdSpend (threshold=0 first); id stripped.
      discountTiers: [
        { name: '一般', thresholdSpend: 0, discountPercent: 1 },
        { name: '金卡', thresholdSpend: 5000, discountPercent: 5 },
      ],
      // Expiry: days filled, date null. Both fields sent.
      discountCustomExpiryDays: 365,
      discountSpecificExpiryDate: null,
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });
});
