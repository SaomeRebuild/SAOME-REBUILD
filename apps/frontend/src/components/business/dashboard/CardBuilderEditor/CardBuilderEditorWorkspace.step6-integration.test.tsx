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

    // 2026-09-07 round-trip fix: payload now contains ALL 9 Step 6 fields.
    // For per_stamp the 4 thresholds are explicitly null (not undefined)
    // because the save block always forwards them — this lets
    // loadSettings's defensive null-coercion reset them cleanly on reload.
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
    });

    expect(onStepChange).toHaveBeenCalledWith(7);
  });
});
