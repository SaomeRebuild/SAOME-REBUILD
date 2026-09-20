/**
 * MultipassTierRow — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the row-level composition (PR-5, 2026-09-20):
 *   - When multipassAccrualMode === 'per_stamp' | null: threshold field
 *     does NOT render.
 *   - When multipassAccrualMode === 'per_visit' | 'per_spend': threshold
 *     field DOES render with the right inputs.
 *   - Other sub-fields (name / stamps / rewardType / rewardValue) always
 *     present.
 *
 * Mocks the heavy sub-fields to keep tests focused on composition +
 * conditional rendering of the threshold.
 *
 * Plan ref: step6_multipass_pr-5_accrual_mode 2026-09-20 § Layer 8.5.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassTierRow } from './MultipassTierRow';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, _params?: Record<string, unknown>) => key),
  })),
}));

// Mock the sub-fields to render minimal testids. The threshold field
// gets a real DOM render so we can assert it shows / hides.
vi.mock('./MultipassTierNameField', () => ({
  MultipassTierNameField: () => <div data-testid="multipass-tier-name-field" />,
}));
vi.mock('./MultipassTierStampsNeededField', () => ({
  MultipassTierStampsNeededField: () => <div data-testid="multipass-tier-stamps-field" />,
}));
vi.mock('./MultipassTierRewardTypeField', () => ({
  MultipassTierRewardTypeField: () => <div data-testid="multipass-tier-reward-type-field" />,
}));
vi.mock('./MultipassTierRewardValueField', () => ({
  MultipassTierRewardValueField: () => <div data-testid="multipass-tier-reward-value-field" />,
}));

const TIER_ID = 'tier-x';

function seed(opts: { mode: 'per_stamp' | 'per_visit' | 'per_spend' | null }) {
  useCardBuilderStore.setState({
    multipassAccrualMode: opts.mode,
    multipassTiers: [
      {
        id: TIER_ID,
        name: 'T',
        stampsNeeded: 0,
        rewardType: null,
        rewardValue: null,
        perVisitCount: null,
        perVisitStamps: null,
        perSpendAmount: null,
        perSpendStamps: null,
      },
    ],
  });
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MultipassTierRow — composition + threshold conditional rendering', () => {
  it('always renders the 4 sub-fields (name / stamps / rewardType / rewardValue)', () => {
    seed({ mode: null });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(screen.getByTestId('multipass-tier-name-field')).toBeInTheDocument();
    expect(screen.getByTestId('multipass-tier-stamps-field')).toBeInTheDocument();
    expect(screen.getByTestId('multipass-tier-reward-type-field')).toBeInTheDocument();
    expect(screen.getByTestId('multipass-tier-reward-value-field')).toBeInTheDocument();
  });

  it('multipassAccrualMode=null → threshold field NOT rendered', () => {
    seed({ mode: null });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(screen.queryByRole('spinbutton', { name: /perVisitVisitsLabel/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: /perSpendAmountLabelTWD/ }),
    ).not.toBeInTheDocument();
  });

  it('multipassAccrualMode=per_stamp → threshold field NOT rendered', () => {
    seed({ mode: 'per_stamp' });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(screen.queryByRole('spinbutton', { name: /perVisitVisitsLabel/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: /perSpendAmountLabelTWD/ }),
    ).not.toBeInTheDocument();
  });

  it('multipassAccrualMode=per_visit → threshold field rendered (count + stamps inputs)', () => {
    seed({ mode: 'per_visit' });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perVisitVisitsLabel' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perVisitStampsLabel' }),
    ).toBeInTheDocument();
    // No per-spend inputs in per_visit mode
    expect(
      screen.queryByRole('spinbutton', { name: /perSpendAmountLabel/ }),
    ).not.toBeInTheDocument();
  });

  it('multipassAccrualMode=per_spend + currency=TWD → threshold field rendered with 元 SUFFIX', () => {
    seed({ mode: 'per_spend' });
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perSpendAmountLabelTWD' }),
    ).toBeInTheDocument();
    // No R prefix on ZAR (we are TWD)
    expect(
      screen.queryByRole('spinbutton', { name: /perSpendAmountLabelZAR/ }),
    ).not.toBeInTheDocument();
  });

  it('multipassAccrualMode=per_spend + currency=ZAR → threshold field rendered with R PREFIX', () => {
    seed({ mode: 'per_spend' });
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<MultipassTierRow showValidation={false} tierId={TIER_ID} duplicateStampsNeeded={null} />);

    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perSpendAmountLabelZAR' }),
    ).toBeInTheDocument();
    // No 元 suffix on ZAR (amount_off + ZAR uses R prefix only)
    expect(
      screen.queryByRole('spinbutton', { name: /perSpendAmountLabelTWD/ }),
    ).not.toBeInTheDocument();
  });
});
