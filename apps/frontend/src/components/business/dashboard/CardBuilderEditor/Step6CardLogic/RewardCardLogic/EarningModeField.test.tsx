/**
 * EarningModeField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level).
 * `<EarningModeField />` is rendered at the top level of `RewardCardLogic`,
 * matching `StampAccrualModeField`'s pattern. It does NOT take `tierId`.
 *
 * Verifies the 3-option radio group:
 *   based_on_points   (自訂條件手動核發)
 *   based_on_visits   (來訪自動加點)
 *   based_on_spending (消費自動加點)
 *
 * Visual contract — mirrors StampAccrualModeField's Pattern A:
 *   - Native `<input type="radio">` is hidden behind `absolute opacity-0 size-5`.
 *   - The visible indicator span carries class `radio-card-fill`; the parent
 *     label carries class `radio-card-primary`.
 *   - Radio group name = `step6-reward-earning-mode` (single group, since
 *     one mode per card).
 *
 * Behavioral contract (Phase 8 — earningMode 切換清除對應 state):
 *   - Switching modes via `setEarningMode` clears ALL per-tier earn rate
 *     fields (pointsPerVisit + pointsPerSpendAmount + pointsPerSpendPoints)
 *     across ALL reward tiers — handled by the store's `setEarningMode`.
 *   - This field's responsibility is only to render the radio group and
 *     forward the click; it does NOT clear state itself.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarningModeField } from './EarningModeField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('EarningModeField (top-level, 2026-09-09 mixed refactor) — Radio Card Pattern A', () => {
  it('renders all three options as native radios (name=step6-reward-earning-mode)', () => {
    render(<EarningModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    for (const r of radios) {
      expect(r.name).toBe('step6-reward-earning-mode');
    }

    const values = radios.map((r) => r.value);
    expect(values).toContain('based_on_points');
    expect(values).toContain('based_on_visits');
    expect(values).toContain('based_on_spending');
  });

  it('hides each native radio via absolute + opacity-0 + size-5 (Pattern A overlay)', () => {
    render(<EarningModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    for (const r of radios) {
      expect(r.className).toContain('absolute');
      expect(r.className).toContain('opacity-0');
      const classes = r.className;
      const isSize5 = classes.includes('size-5') || (classes.includes('h-5') && classes.includes('w-5'));
      expect(isSize5).toBe(true);
    }
  });

  it('renders helper text for each mode', () => {
    render(<EarningModeField showValidation={false} />);

    expect(screen.getAllByText('step6.reward.modes.based_on_points.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.reward.modes.based_on_visits.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.reward.modes.based_on_spending.helper')).toHaveLength(1);
  });

  it('renders title and description', () => {
    render(<EarningModeField showValidation={false} />);

    expect(screen.getByText('step6.reward.earningModeTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.earningModeDescription')).toBeInTheDocument();
  });

  it('clicking based_on_visits updates top-level earningMode', async () => {
    const user = userEvent.setup();
    render(<EarningModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const visitsRadio = radios.find((r) => r.value === 'based_on_visits')!;
    await user.click(visitsRadio);

    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_visits');
  });

  it('clicking based_on_spending updates top-level earningMode', async () => {
    const user = userEvent.setup();
    render(<EarningModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const spendingRadio = radios.find((r) => r.value === 'based_on_spending')!;
    await user.click(spendingRadio);

    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_spending');
  });

  it('clicking based_on_points updates top-level earningMode', async () => {
    const user = userEvent.setup();
    render(<EarningModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const pointsRadio = radios.find((r) => r.value === 'based_on_points')!;
    await user.click(pointsRadio);

    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_points');
  });
});

describe('EarningModeField — store state-clearing on mode switch (Phase 8 spec, top-level)', () => {
  it('switching top-level earningMode to based_on_points clears ALL tiers\' pointsPerVisit + pointsPerSpendAmount + pointsPerSpendPoints', async () => {
    const user = userEvent.setup();
    // Tier A: visits/10, Tier B: spending/100/1
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
        {
          id: 'b',
          name: 'B',
          threshold: 200,
          rewardType: 'amount_off',
          rewardValue: 20,
          maxDiscountAmount: null,
          pointsPerVisit: 5,
          pointsPerSpendAmount: 200,
          pointsPerSpendPoints: 2,
        },
      ],
    });

    render(<EarningModeField showValidation={false} />);
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const pointsRadio = radios.find((r) => r.value === 'based_on_points')!;
    await user.click(pointsRadio);

    const after = useCardBuilderStore.getState().rewardTiers;
    // Both tiers cleared across the board
    for (const tier of after) {
      expect(tier.pointsPerVisit).toBeNull();
      expect(tier.pointsPerSpendAmount).toBeNull();
      expect(tier.pointsPerSpendPoints).toBeNull();
    }
    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_points');
  });

  it('switching top-level earningMode to based_on_visits clears ALL tiers\' pointsPerSpendAmount + pointsPerSpendPoints', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
      ],
    });

    render(<EarningModeField showValidation={false} />);
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const visitsRadio = radios.find((r) => r.value === 'based_on_visits')!;
    await user.click(visitsRadio);

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerSpendAmount).toBeNull();
    expect(tier.pointsPerSpendPoints).toBeNull();
    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_visits');
  });

  it('switching top-level earningMode to based_on_spending clears ALL tiers\' pointsPerVisit', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });

    render(<EarningModeField showValidation={false} />);
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const spendingRadio = radios.find((r) => r.value === 'based_on_spending')!;
    await user.click(spendingRadio);

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerVisit).toBeNull();
    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_spending');
  });

  it('clicking the same radio twice is a no-op (mode unchanged)', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.getState().setEarningMode('based_on_visits');
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
        },
      ],
    });

    render(<EarningModeField showValidation={false} />);
    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const visitsRadio = radios.find((r) => r.value === 'based_on_visits')!;
    await user.click(visitsRadio);

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    // mode unchanged → no-op: pointsPerVisit should stay at 10 (NOT cleared)
    expect(tier.pointsPerVisit).toBe(10);
    expect(useCardBuilderStore.getState().earningMode).toBe('based_on_visits');
  });
});