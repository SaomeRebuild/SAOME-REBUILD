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

  it('Next button is ALWAYS enabled for non-stamp card types (ComingSoon, always valid)', () => {
    useCardBuilderStore.setState({ cardType: 'cashback_card' });
    render(
      <CardBuilderEditorWorkspace
        step={6}
        onStepChange={vi.fn()}
        cardType="cashback_card"
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
      rewardTiers: [],
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
      rewardTiers: [],
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
      rewardTiers: [],
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
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });

  // ===== isRewardStep6Valid tests (2026-09-09 mixed refactor) =====
  it('reward_card: Next disabled when card-wide earningMode is null', () => {
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      earningMode: null,
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
});
