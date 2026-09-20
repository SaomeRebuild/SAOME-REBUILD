/**
 * MultipassTierAccrualThresholdField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies per-tier threshold field behavior (PR-5, 2026-09-20):
 *   - multipassAccrualMode === null → returns null (no render)
 *   - multipassAccrualMode === 'per_stamp' → returns null (no render)
 *   - multipassAccrualMode === 'per_visit' → renders 2 inputs + labels
 *   - multipassAccrualMode === 'per_spend' + currency='TWD' → 元 SUFFIX
 *   - multipassAccrualMode === 'per_spend' + currency='ZAR' → R PREFIX
 *   - typing in input updates store.perVisitCount / perSpendAmount etc.
 *   - showValidation=true + null fields → red border + error message
 *
 * Plan ref: step6_multipass_pr-5_accrual_mode 2026-09-20 § Layer 8.3.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassTierAccrualThresholdField } from './MultipassTierAccrualThresholdField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, _params?: Record<string, unknown>) => key),
  })),
}));

const TIER_ID = 'tier-x';

function seed(opts: {
  mode: 'per_stamp' | 'per_visit' | 'per_spend' | null;
  perVisitCount?: number | null;
  perVisitStamps?: number | null;
  perSpendAmount?: number | null;
  perSpendStamps?: number | null;
  currency?: 'TWD' | 'ZAR';
}) {
  useCardBuilderStore.setState({
    currency: opts.currency ?? 'TWD',
    multipassAccrualMode: opts.mode,
    multipassTiers: [
      {
        id: TIER_ID,
        name: 'T',
        stampsNeeded: 0,
        rewardType: null,
        rewardValue: null,
        perVisitCount: opts.perVisitCount ?? null,
        perVisitStamps: opts.perVisitStamps ?? null,
        perSpendAmount: opts.perSpendAmount ?? null,
        perSpendStamps: opts.perSpendStamps ?? null,
      },
    ],
  });
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MultipassTierAccrualThresholdField — conditional rendering', () => {
  it('multipassAccrualMode=null → renders nothing', () => {
    seed({ mode: null });
    const { container } = render(
      <MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />,
    );
    // No per-visit / per-spend inputs present
    expect(container.querySelector('input[id$="-per-visit-count"]')).toBeNull();
    expect(container.querySelector('input[id$="-per-spend-amount"]')).toBeNull();
    expect(container.querySelector('input[id$="-per-visit-stamps"]')).toBeNull();
    expect(container.querySelector('input[id$="-per-spend-stamps"]')).toBeNull();
  });

  it('multipassAccrualMode=per_stamp → renders nothing', () => {
    seed({ mode: 'per_stamp' });
    const { container } = render(
      <MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />,
    );
    expect(container.querySelector('input[id$="-per-visit-count"]')).toBeNull();
    expect(container.querySelector('input[id$="-per-spend-amount"]')).toBeNull();
  });

  it('multipassAccrualMode=per_visit → renders 2 per-visit inputs', () => {
    seed({ mode: 'per_visit' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);

    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perVisitVisitsLabel' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: 'step6.multipass.tier.perVisitStampsLabel' }),
    ).toBeInTheDocument();
    // No per-spend inputs in per_visit mode
    expect(screen.queryByRole('spinbutton', { name: /perSpendAmountLabel/ })).not.toBeInTheDocument();
  });

  it('multipassAccrualMode=per_spend + currency=TWD → renders per-spend with 元 SUFFIX', () => {
    seed({ mode: 'per_spend', currency: 'TWD' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);

    const suffixSpans = screen.getAllByText('step6.multipass.tier.perSpendAmountLabelTWD');
    expect(suffixSpans).toHaveLength(1);
    expect(screen.queryByText('step6.multipass.tier.perSpendAmountLabelZAR')).not.toBeInTheDocument();
    const amountInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perSpendAmountLabelTWD',
    }) as HTMLInputElement;
    expect(amountInput.className).toContain('pr-12');
    expect(amountInput.className).not.toContain('pl-12');
  });

  it('multipassAccrualMode=per_spend + currency=ZAR → renders per-spend with R PREFIX', () => {
    seed({ mode: 'per_spend', currency: 'ZAR' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);

    const prefixSpans = screen.getAllByText('step6.multipass.tier.perSpendAmountLabelZAR');
    expect(prefixSpans).toHaveLength(1);
    expect(screen.queryByText('step6.multipass.tier.perSpendAmountLabelTWD')).not.toBeInTheDocument();
    const amountInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perSpendAmountLabelZAR',
    }) as HTMLInputElement;
    expect(amountInput.className).toContain('pl-12');
    expect(amountInput.className).not.toContain('pr-12');
  });
});

describe('MultipassTierAccrualThresholdField — store updates', () => {
  it('typing in per-visit-count updates store.multipassTiers[i].perVisitCount', async () => {
    seed({ mode: 'per_visit' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);
    const user = userEvent.setup();

    const countInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perVisitVisitsLabel',
    });
    await user.type(countInput, '3');

    expect(useCardBuilderStore.getState().multipassTiers[0]?.perVisitCount).toBe(3);
  });

  it('typing in per-visit-stamps updates store.multipassTiers[i].perVisitStamps', async () => {
    seed({ mode: 'per_visit' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);
    const user = userEvent.setup();

    const stampsInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perVisitStampsLabel',
    });
    await user.type(stampsInput, '2');

    expect(useCardBuilderStore.getState().multipassTiers[0]?.perVisitStamps).toBe(2);
  });

  it('typing in per-spend-amount updates store.multipassTiers[i].perSpendAmount', async () => {
    seed({ mode: 'per_spend', currency: 'TWD' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);
    const user = userEvent.setup();

    const amountInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perSpendAmountLabelTWD',
    });
    await user.type(amountInput, '500');

    expect(useCardBuilderStore.getState().multipassTiers[0]?.perSpendAmount).toBe(500);
  });

  it('typing in per-spend-stamps updates store.multipassTiers[i].perSpendStamps', async () => {
    seed({ mode: 'per_spend', currency: 'TWD' });
    render(<MultipassTierAccrualThresholdField showValidation={false} tierId={TIER_ID} />);
    const user = userEvent.setup();

    const stampsInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perSpendStampsLabel',
    });
    await user.type(stampsInput, '5');

    expect(useCardBuilderStore.getState().multipassTiers[0]?.perSpendStamps).toBe(5);
  });
});

describe('MultipassTierAccrualThresholdField — validation surface', () => {
  it('per_visit + showValidation=true + any null field → red border + error', () => {
    seed({ mode: 'per_visit' });
    render(<MultipassTierAccrualThresholdField showValidation={true} tierId={TIER_ID} />);

    const countInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perVisitVisitsLabel',
    }) as HTMLInputElement;
    const stampsInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perVisitStampsLabel',
    }) as HTMLInputElement;
    expect(countInput.getAttribute('aria-invalid')).toBe('true');
    expect(stampsInput.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('step6.multipass.tier.accrualThresholdRequiredError'),
    ).toBeInTheDocument();
  });

  it('per_visit + showValidation=true + both fields filled → NO error / red border', () => {
    seed({ mode: 'per_visit', perVisitCount: 2, perVisitStamps: 1 });
    render(<MultipassTierAccrualThresholdField showValidation={true} tierId={TIER_ID} />);

    const countInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perVisitVisitsLabel',
    }) as HTMLInputElement;
    expect(countInput.getAttribute('aria-invalid')).toBe('false');
    expect(
      screen.queryByText('step6.multipass.tier.accrualThresholdRequiredError'),
    ).not.toBeInTheDocument();
  });

  it('per_spend + showValidation=true + any null field → red border + error', () => {
    seed({ mode: 'per_spend', currency: 'TWD' });
    render(<MultipassTierAccrualThresholdField showValidation={true} tierId={TIER_ID} />);

    const amountInput = screen.getByRole('spinbutton', {
      name: 'step6.multipass.tier.perSpendAmountLabelTWD',
    }) as HTMLInputElement;
    expect(amountInput.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('step6.multipass.tier.accrualThresholdRequiredError'),
    ).toBeInTheDocument();
  });
});
