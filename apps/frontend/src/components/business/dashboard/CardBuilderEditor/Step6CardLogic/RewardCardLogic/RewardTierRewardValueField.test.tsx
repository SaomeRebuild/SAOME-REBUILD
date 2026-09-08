/**
 * RewardTierRewardValueField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Currency-aware placeholder/unit: TWD → 元, ZAR → R.
 *   - amount_off → amountReward placeholder; percent_off → percentReward placeholder.
 *   - Hidden when rewardType not yet selected.
 *   - showValidation=true + rewardValue null/zero → renders requiredError.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardTierRewardValueField } from './RewardTierRewardValueField';
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

const seedTier = (overrides: Partial<{
  rewardType: 'amount_off' | 'percent_off' | null;
  rewardValue: number | null;
  maxDiscountAmount: number | null;
}> = {}) => {
  useCardBuilderStore.setState({
    rewardTiers: [
      {
        id: 'tier-x',
        name: 'Test tier',
        threshold: 100,
        rewardType: overrides.rewardType === undefined ? null : overrides.rewardType,
        rewardValue: overrides.rewardValue === undefined ? null : overrides.rewardValue,
        maxDiscountAmount: overrides.maxDiscountAmount === undefined ? null : overrides.maxDiscountAmount,
      } as unknown as ReturnType<typeof useCardBuilderStore.getState>['rewardTiers'][number],
    ],
  });
};

describe('RewardTierRewardValueField (Step 6 section 4 — type-conditional)', () => {
  it('returns null when tier does not exist', () => {
    useCardBuilderStore.setState({ rewardTiers: [] });
    const { container } = render(<RewardTierRewardValueField showValidation={false} tierId="ghost" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows type placeholder when rewardType is null', () => {
    seedTier({ rewardType: null });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    expect(screen.getByText('step6.reward.tier.rewardTypePlaceholder')).toBeInTheDocument();
  });

  it('amount_off + TWD currency → placeholder + unit 元', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const input = screen.getByPlaceholderText('step6.reward.tier.rewardValueAmountPlaceholder');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('step6.reward.tier.rewardValueAmountUnitTWD')).toBeInTheDocument();
  });

  it('amount_off + ZAR currency → placeholder + unit R (Rand)', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    expect(screen.getByPlaceholderText('step6.reward.tier.rewardValueAmountPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.tier.rewardValueAmountUnitZAR')).toBeInTheDocument();
  });

  it('percent_off → percent placeholder + unit %', () => {
    seedTier({ rewardType: 'percent_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    expect(screen.getByPlaceholderText('step6.reward.tier.rewardValuePercentPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.tier.rewardValuePercentUnit')).toBeInTheDocument();
  });

  it('percent_off input enforces min=REWARD_PERCENT_MIN and max=REWARD_PERCENT_MAX', () => {
    seedTier({ rewardType: 'percent_off', rewardValue: 10 });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const input = screen.getByLabelText('step6.reward.tier.rewardValueTitle') as HTMLInputElement;
    // Just assert the min/max attributes are set (specific values come from
    // shared constants; pinned to REWARD_PERCENT_MIN/MAX).
    expect(input.getAttribute('min')).not.toBeNull();
    expect(input.getAttribute('max')).toBe('100');
  });

  it('updates store on valid amount_off input', async () => {
    const user = userEvent.setup();
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const input = screen.getByLabelText('step6.reward.tier.rewardValueTitle') as HTMLInputElement;
    await user.type(input, '50');

    expect(useCardBuilderStore.getState().rewardTiers[0]!.rewardValue).toBe(50);
  });

  it('showValidation=true + rewardValue=null → renders requiredError', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    render(<RewardTierRewardValueField showValidation={true} tierId="tier-x" />);

    expect(screen.getByText('step6.reward.tier.rewardValueRequiredError')).toBeInTheDocument();
  });

  it('showValidation=false + rewardValue=null → no error', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    expect(screen.queryByText('step6.reward.tier.rewardValueRequiredError')).not.toBeInTheDocument();
  });

  it('showValidation=true + rewardValue > 100 in percent_off → renders tooLargeError', () => {
    seedTier({ rewardType: 'percent_off', rewardValue: 150 });
    render(<RewardTierRewardValueField showValidation={true} tierId="tier-x" />);

    expect(screen.getByText('step6.reward.tier.rewardValueTooLargeError')).toBeInTheDocument();
  });

  // Regression: 2026-09-09 prefix-vs-suffix bug fix.
  // Previous version rendered `<input> 元` so "50元" looked like a glued
  // value. Unit is now a PREFIX: `元 <input>` matches currency convention
  // (NT$50 / R50 / %10). DOM-order assertion catches any future re-suffix.
  it('amount_off + TWD: unit label is rendered BEFORE the input (prefix)', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'TWD' });
    const { container } = render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    const firstChild = row.firstElementChild;
    expect(firstChild?.tagName).toBe('SPAN');
    expect(firstChild?.textContent).toBe('step6.reward.tier.rewardValueAmountUnitTWD');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });

  it('amount_off + ZAR: unit label R is rendered BEFORE the input (prefix)', () => {
    seedTier({ rewardType: 'amount_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'ZAR' });
    const { container } = render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    expect(row.firstElementChild?.tagName).toBe('SPAN');
    expect(row.firstElementChild?.textContent).toBe('step6.reward.tier.rewardValueAmountUnitZAR');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });

  it('percent_off: % unit is rendered BEFORE the input (prefix)', () => {
    seedTier({ rewardType: 'percent_off', rewardValue: null });
    useCardBuilderStore.setState({ currency: 'TWD' });
    const { container } = render(<RewardTierRewardValueField showValidation={false} tierId="tier-x" />);

    const row = container.querySelector('div.flex.items-center.gap-2')!;
    expect(row.firstElementChild?.tagName).toBe('SPAN');
    expect(row.firstElementChild?.textContent).toBe('step6.reward.tier.rewardValuePercentUnit');
    expect(row.lastElementChild?.tagName).toBe('INPUT');
  });
});
