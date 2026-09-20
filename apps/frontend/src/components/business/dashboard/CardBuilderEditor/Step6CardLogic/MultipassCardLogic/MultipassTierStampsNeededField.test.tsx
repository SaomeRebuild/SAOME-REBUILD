/**
 * MultipassTierStampsNeededField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the multipass-unique stampsNeeded field:
 *   - Renders the current numeric value (including 0 = welcome gift).
 *   - Updates store.multipassTiers[i].stampsNeeded on input change.
 *   - Empty input resets to 0.
 *   - Validation error shows when out of [0, 999] (defensive — store setter
 *     already clamps).
 *
 * PR-4 (2026-09-19): all existing tests must pass `duplicateStampsNeeded={null}`
 * so the field renders without the warning icon (warning behavior is owned by
 * the MultipassTierList integration — see MultipassTierList.test.tsx).
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassTierStampsNeededField } from './MultipassTierStampsNeededField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

const seedTier = (overrides: Partial<{
  stampsNeeded: number;
}> = {}) => {
  useCardBuilderStore.setState({
    multipassTiers: [
      {
        id: 'tier-x',
        name: 'Test tier',
        stampsNeeded: overrides.stampsNeeded ?? 5,
        rewardType: 'amount_off',
        rewardValue: 10,
        perVisitCount: null,
        perVisitStamps: null,
        perSpendAmount: null,
        perSpendStamps: null,
      },
    ],
  });
};

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MultipassTierStampsNeededField — multipass-unique stampsNeeded', () => {
  it('renders the current numeric value', () => {
    seedTier({ stampsNeeded: 5 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(5);
  });

  it('renders 0 as "0" (welcome gift display — not empty)', () => {
    // Mirrors the cashback threshold-0 fix (2026-09-11): 0 is a
    // legitimate value (welcome gift "辦卡立刻送"), must display as "0".
    seedTier({ stampsNeeded: 0 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(0);
  });

  it('updates store.multipassTiers[i].stampsNeeded on valid input', () => {
    seedTier({ stampsNeeded: 5 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });

    expect(useCardBuilderStore.getState().multipassTiers[0].stampsNeeded).toBe(10);
  });

  it('empty input resets to 0 (welcome gift default)', () => {
    seedTier({ stampsNeeded: 5 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });

    expect(useCardBuilderStore.getState().multipassTiers[0].stampsNeeded).toBe(0);
  });

  it('renders the helper text under the input', () => {
    seedTier({ stampsNeeded: 5 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    expect(
      screen.getByText('step6.multipass.tier.stampsNeededHelper'),
    ).toBeInTheDocument();
  });

  it('renders the unit label "個印章" suffix', () => {
    seedTier({ stampsNeeded: 5 });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    expect(
      screen.getByText('step6.multipass.tier.stampsNeededUnit'),
    ).toBeInTheDocument();
  });

  it('shows validation error when showValidation=true and stampsNeeded > 999 (corrupted DB bypass)', () => {
    // Store setter clamps to [0, 999]; loadSettings could surface a
    // corrupted DB row with out-of-range value. We bypass the setter
    // by writing directly to the state shape.
    useCardBuilderStore.setState({
      multipassTiers: [
        {
          id: 'tier-x',
          name: 'T',
          stampsNeeded: 1500,
          rewardType: 'amount_off',
          rewardValue: 10,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: null,
          perSpendStamps: null,
        },
      ],
    });
    render(<MultipassTierStampsNeededField showValidation={true} tierId="tier-x" duplicateStampsNeeded={null} />);

    expect(
      screen.getByText('step6.multipass.tier.stampsNeededMaxError'),
    ).toBeInTheDocument();
  });

  it('does NOT show validation error when showValidation=false even if stampsNeeded is out of range', () => {
    useCardBuilderStore.setState({
      multipassTiers: [
        {
          id: 'tier-x',
          name: 'T',
          stampsNeeded: 1500,
          rewardType: 'amount_off',
          rewardValue: 10,
          perVisitCount: null,
          perVisitStamps: null,
          perSpendAmount: null,
          perSpendStamps: null,
        },
      ],
    });
    render(<MultipassTierStampsNeededField showValidation={false} tierId="tier-x" duplicateStampsNeeded={null} />);

    expect(
      screen.queryByText('step6.multipass.tier.stampsNeededMaxError'),
    ).not.toBeInTheDocument();
  });
});
