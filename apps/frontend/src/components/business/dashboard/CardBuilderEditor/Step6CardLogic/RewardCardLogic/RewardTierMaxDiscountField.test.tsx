/**
 * RewardTierMaxDiscountField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention; TWD keeps suffix
 * (元 after) per zh-TW convention. The render pins the unit position
 * relative to the input element.
 *
 * Verifies:
 *   - Returns null when tierId is not in store.
 *   - Returns null when tier.rewardType !== 'percent_off' (conditional render).
 *   - Renders only when rewardType === 'percent_off'.
 *   - Updates tier.maxDiscountAmount on valid input.
 *   - Empty input → tier.maxDiscountAmount = null (means "no cap").
 *   - Negative input rejected (does not update store).
 *   - TWD currency → unit 元 rendered AFTER the input (suffix).
 *   - ZAR currency → unit R rendered BEFORE the input (prefix).
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardTierMaxDiscountField } from './RewardTierMaxDiscountField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

function seedTier(
  rewardType: 'amount_off' | 'percent_off' = 'percent_off',
  maxDiscountAmount: number | null = null,
) {
  // Note: do NOT call setCurrency() here — tests that need ZAR must set
  // it explicitly so the component reads the right currency at render time.
  useCardBuilderStore.getState().addRewardTier();
  const tier = useCardBuilderStore.getState().rewardTiers[0]!;
  tier.rewardType = rewardType;
  tier.maxDiscountAmount = maxDiscountAmount;
  useCardBuilderStore.setState({ rewardTiers: [...useCardBuilderStore.getState().rewardTiers] });
  return tier.id;
}

function seedTierWithNullRewardType() {
  // Test-only helper: tier.rewardType = null exercises the conditional
  // render branch in RewardTierMaxDiscountField (returns null). Cast is
  // required because RewardTierShape declares rewardType as non-null,
  // but the component's runtime check `tier.rewardType !== 'percent_off'`
  // treats null as "not percent_off" and returns null — this test pins
  // that defensive behavior.
  useCardBuilderStore.getState().addRewardTier();
  const tier = useCardBuilderStore.getState().rewardTiers[0]!;
  (tier as { rewardType: 'amount_off' | 'percent_off' | null }).rewardType = null;
  useCardBuilderStore.setState({ rewardTiers: [...useCardBuilderStore.getState().rewardTiers] });
  return tier.id;
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardTierMaxDiscountField (percent_off sub-field — Step 6 tier section 5)', () => {
  it('returns null when tierId is not in store', () => {
    const { container } = render(
      <RewardTierMaxDiscountField showValidation={false} tierId="nonexistent" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when rewardType is amount_off (conditional render)', () => {
    const tierId = seedTier('amount_off');
    const { container } = render(
      <RewardTierMaxDiscountField showValidation={false} tierId={tierId} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when rewardType is null', () => {
    const tierId = seedTierWithNullRewardType();
    const { container } = render(
      <RewardTierMaxDiscountField showValidation={false} tierId={tierId} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and placeholder when rewardType is percent_off', () => {
    const tierId = seedTier('percent_off');
    render(<RewardTierMaxDiscountField showValidation={false} tierId={tierId} />);

    expect(screen.getByText('step6.reward.tier.maxDiscountTitle')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.tier.maxDiscountPlaceholder'),
    ).toBeInTheDocument();
  });

  it('updates tier.maxDiscountAmount on valid input', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('percent_off', null);
    render(<RewardTierMaxDiscountField showValidation={false} tierId={tierId} />);

    const input = screen.getByPlaceholderText('step6.reward.tier.maxDiscountPlaceholder') as HTMLInputElement;
    await user.type(input, '100');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.maxDiscountAmount).toBe(100);
  });

  it('empty input sets tier.maxDiscountAmount = null (means "no cap")', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('percent_off', 50);
    render(<RewardTierMaxDiscountField showValidation={false} tierId={tierId} />);

    const input = screen.getByPlaceholderText('step6.reward.tier.maxDiscountPlaceholder') as HTMLInputElement;
    await user.clear(input);

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.maxDiscountAmount).toBeNull();
  });

  it('negative input is rejected (does not update store)', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('percent_off', 50);
    render(<RewardTierMaxDiscountField showValidation={false} tierId={tierId} />);

    const input = screen.getByPlaceholderText('step6.reward.tier.maxDiscountPlaceholder') as HTMLInputElement;
    input.focus();
    await user.paste('-10');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    // Unchanged from initial 50 because negative input is rejected by onChange.
    expect(tier.maxDiscountAmount).toBe(50);
  });

  // 2026-09-09 currency placement fix — TWD keeps 元 as suffix; ZAR uses R
  // as prefix (South African Rand convention). These tests pin the unit
  // position relative to the input element in DOM order.
  describe('currency-aware unit placement (2026-09-09)', () => {
    it('TWD currency → unit 元 rendered AFTER the amount input (suffix notation)', () => {
      // afterEach reset → currency is TWD by default.
      const tierId = seedTier('percent_off');
      const { container } = render(
        <RewardTierMaxDiscountField showValidation={false} tierId={tierId} />,
      );

      const input = container.querySelector(
        `input[id="step6-tier-${tierId}-max-discount"]`,
      );
      expect(input).not.toBeNull();

      const row = input!.closest('div')!;
      const children = Array.from(row.children);
      const inputIdx = children.indexOf(input as Element);
      // TWD unit key should appear AFTER the input.
      const twdUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitTWD',
      );
      expect(twdUnitIdx).toBeGreaterThan(inputIdx);

      // ZAR unit key must NOT appear when currency is TWD.
      const zarUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitZAR',
      );
      expect(zarUnitIdx).toBe(-1);
    });

    it('ZAR currency → unit R rendered BEFORE the amount input (prefix notation)', () => {
      // Set currency AFTER seedTier so the component reads ZAR at render time.
      const tierId = seedTier('percent_off');
      useCardBuilderStore.getState().setCurrency('ZAR');
      const { container } = render(
        <RewardTierMaxDiscountField showValidation={false} tierId={tierId} />,
      );

      const input = container.querySelector(
        `input[id="step6-tier-${tierId}-max-discount"]`,
      );
      expect(input).not.toBeNull();

      const row = input!.closest('div')!;
      const children = Array.from(row.children);
      const inputIdx = children.indexOf(input as Element);
      // ZAR unit key should appear BEFORE the input.
      const zarUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitZAR',
      );
      expect(zarUnitIdx).toBeGreaterThanOrEqual(0);
      expect(zarUnitIdx).toBeLessThan(inputIdx);

      // TWD unit key must NOT appear when currency is ZAR.
      const twdUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitTWD',
      );
      expect(twdUnitIdx).toBe(-1);
    });

    it('switching currency from TWD to ZAR moves unit from suffix to prefix position', () => {
      const tierId = seedTier('percent_off');
      const { container, rerender } = render(
        <RewardTierMaxDiscountField showValidation={false} tierId={tierId} />,
      );

      // Verify initial TWD state.
      const twdInput = container.querySelector(
        `input[id="step6-tier-${tierId}-max-discount"]`,
      )!;
      const twdRow = twdInput.closest('div')!;
      const twdChildren = Array.from(twdRow.children);
      const twdInputIdx = twdChildren.indexOf(twdInput as Element);
      expect(
        twdChildren.findIndex(
          (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitTWD',
        ),
      ).toBeGreaterThan(twdInputIdx);

      // Switch to ZAR and re-render.
      useCardBuilderStore.getState().setCurrency('ZAR');
      rerender(<RewardTierMaxDiscountField showValidation={false} tierId={tierId} />);

      const zarInput = container.querySelector(
        `input[id="step6-tier-${tierId}-max-discount"]`,
      )!;
      const zarRow = zarInput.closest('div')!;
      const zarChildren = Array.from(zarRow.children);
      const zarInputIdx = zarChildren.indexOf(zarInput as Element);
      const zarUnitIdx = zarChildren.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.tier.maxDiscountUnitZAR',
      );
      expect(zarUnitIdx).toBeGreaterThanOrEqual(0);
      expect(zarUnitIdx).toBeLessThan(zarInputIdx);
    });
  });
});
