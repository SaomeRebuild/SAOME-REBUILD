/**
 * RewardTierList — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Renders one RewardTierRow per rewardTier.
 *   - "新增獎勵級距" button appends a new tier via addRewardTier.
 *   - Button is disabled at MAX_REWARD_TIERS=5.
 *   - "maxTiersReached" hint is shown when at cap.
 *   - Empty state shows "tierUnknown" hint.
 *   - sortRewardTiers orders tiers by threshold ascending.
 *
 * 2026-09-09 mixed refactor: per-tier `earningMode` is GONE — it's at top-level.
 * Tests cover the new per-tier earn rate init + update guards
 * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints), and
 * verify the card-wide `setEarningMode` clears all per-tier earn rate fields.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardTierList } from './RewardTierList';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_REWARD_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, _params?: Record<string, unknown>) => key),
  })),
}));

// Mock RewardTierRow so we can count how many are rendered without depending
// on each row's sub-field implementations.
let tierRowRenderCount = 0;
vi.mock('./RewardTierRow', () => ({
  RewardTierRow: ({ tierId }: { tierId: string }) => {
    tierRowRenderCount += 1;
    return <div data-testid={`reward-tier-row-${tierId}`}>TierRow</div>;
  },
}));

afterEach(() => {
  tierRowRenderCount = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardTierList (Step 6 section 3) — CRUD', () => {
  it('renders empty state hint when rewardTiers is empty', () => {
    useCardBuilderStore.setState({ rewardTiers: [] });
    render(<RewardTierList showValidation={false} />);

    expect(screen.getByText('step6.reward.preview.tierUnknown')).toBeInTheDocument();
  });

  it('renders one RewardTierRow per tier', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
        { id: 'b', name: 'B', threshold: 200, rewardType: 'percent_off', rewardValue: 5, maxDiscountAmount: 50 },
        { id: 'c', name: 'C', threshold: 300, rewardType: 'amount_off', rewardValue: 30, maxDiscountAmount: null },
      ],
    });
    render(<RewardTierList showValidation={false} />);

    expect(screen.getByTestId('reward-tier-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('reward-tier-row-b')).toBeInTheDocument();
    expect(screen.getByTestId('reward-tier-row-c')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(3);
  });

  it('"新增獎勵級距" button appends an empty tier via addRewardTier', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardTiers: [] });
    render(<RewardTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.reward.addTier' });
    await user.click(addBtn);

    const s = useCardBuilderStore.getState();
    expect(s.rewardTiers).toHaveLength(1);
    expect(s.rewardTiers[0]!.id).toBeTruthy();
    expect(s.rewardTiers[0]!.name).toBe('');
    expect(s.rewardTiers[0]!.threshold).toBe(0);
  });

  it('add button is disabled at MAX_REWARD_TIERS=5', () => {
    const tiers = Array.from({ length: MAX_REWARD_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `t${i}`,
      threshold: (i + 1) * 100,
      rewardType: 'amount_off' as const,
      rewardValue: 10,
      maxDiscountAmount: null,
    }));
    useCardBuilderStore.setState({ rewardTiers: tiers });
    render(<RewardTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.reward.addTier' });
    expect(addBtn).toBeDisabled();
  });

  it('shows maxTiersReached hint when at cap', () => {
    const tiers = Array.from({ length: MAX_REWARD_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `t${i}`,
      threshold: (i + 1) * 100,
      rewardType: 'amount_off' as const,
      rewardValue: 10,
      maxDiscountAmount: null,
    }));
    useCardBuilderStore.setState({ rewardTiers: tiers });
    render(<RewardTierList showValidation={false} />);

    expect(screen.getByText('step6.reward.maxTiersReached')).toBeInTheDocument();
  });

  it('hides maxTiersReached hint when below cap', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
      ],
    });
    render(<RewardTierList showValidation={false} />);

    expect(screen.queryByText('step6.reward.maxTiersReached')).not.toBeInTheDocument();
  });
});

describe('RewardTierList — store actions integration', () => {
  it('removeRewardTier deletes a tier by id', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
        { id: 'b', name: 'B', threshold: 200, rewardType: 'amount_off', rewardValue: 20, maxDiscountAmount: null },
      ],
    });
    render(<RewardTierList showValidation={false} />);

    // Use the store action directly (the row's delete button calls it).
    useCardBuilderStore.getState().removeRewardTier('a');

    const s = useCardBuilderStore.getState();
    expect(s.rewardTiers).toHaveLength(1);
    expect(s.rewardTiers[0]!.id).toBe('b');
  });

  it('sortRewardTiers orders tiers by threshold ascending', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'high', name: 'H', threshold: 1000, rewardType: 'amount_off', rewardValue: 100, maxDiscountAmount: null },
        { id: 'low', name: 'L', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
        { id: 'mid', name: 'M', threshold: 500, rewardType: 'amount_off', rewardValue: 50, maxDiscountAmount: null },
      ],
    });

    useCardBuilderStore.getState().sortRewardTiers();
    const s = useCardBuilderStore.getState();
    expect(s.rewardTiers.map((t) => t.id)).toEqual(['low', 'mid', 'high']);
  });

  it('updateRewardTier patches a single field without losing others', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { name: 'A updated' });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.name).toBe('A updated');
    expect(tier.threshold).toBe(100);
    expect(tier.rewardType).toBe('amount_off');
    expect(tier.rewardValue).toBe(10);
  });

  it('updateRewardTier switching rewardType clears rewardValue + maxDiscountAmount', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { rewardType: 'percent_off' });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.rewardType).toBe('percent_off');
    expect(tier.rewardValue).toBeNull();
    expect(tier.maxDiscountAmount).toBeNull();
  });

  it('updateRewardTier clamps rewardValue to > 0 (rejects 0 / negative)', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { rewardValue: 0 });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.rewardValue).toBe(10); // unchanged
  });

  // ===== Per-tier earn rate field tests (2026-09-09 mixed refactor) =====
  it('addRewardTier initializes per-tier earn rate fields to null (no per-tier earningMode)', () => {
    useCardBuilderStore.setState({ rewardTiers: [] });
    useCardBuilderStore.getState().addRewardTier();

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerVisit).toBeNull();
    expect(tier.pointsPerSpendAmount).toBeNull();
    expect(tier.pointsPerSpendPoints).toBeNull();
    // 2026-09-09 mixed refactor: per-tier earningMode is gone (top-level only).
    expect((tier as unknown as { earningMode?: unknown }).earningMode).toBeUndefined();
  });

  it('updateRewardTier patches pointsPerVisit on a tier (does not affect other tiers)', () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null, pointsPerVisit: null },
        { id: 'b', name: 'B', threshold: 200, rewardType: 'amount_off', rewardValue: 20, maxDiscountAmount: null, pointsPerVisit: 5 },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { pointsPerVisit: 10 });

    const a = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === 'a')!;
    const b = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === 'b')!;
    expect(a.pointsPerVisit).toBe(10);
    // b is untouched
    expect(b.pointsPerVisit).toBe(5);
  });

  it('setEarningMode (card-wide) clears ALL tiers\' pointsPerVisit + pointsPerSpendAmount + pointsPerSpendPoints', () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null, pointsPerVisit: 10, pointsPerSpendAmount: 100, pointsPerSpendPoints: 1 },
        { id: 'b', name: 'B', threshold: 200, rewardType: 'amount_off', rewardValue: 20, maxDiscountAmount: null, pointsPerVisit: 5, pointsPerSpendAmount: 200, pointsPerSpendPoints: 2 },
      ],
    });

    // Switch card-wide mode → all per-tier earn rate fields cleared.
    useCardBuilderStore.getState().setEarningMode('based_on_points');

    const after = useCardBuilderStore.getState();
    expect(after.earningMode).toBe('based_on_points');
    for (const tier of after.rewardTiers) {
      expect(tier.pointsPerVisit).toBeNull();
      expect(tier.pointsPerSpendAmount).toBeNull();
      expect(tier.pointsPerSpendPoints).toBeNull();
    }
  });

  it('setEarningMode to based_on_visits clears ALL tiers\' pointsPerSpendAmount + pointsPerSpendPoints (keeps no earn rate, mode is per-card)', () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_spending',
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null, pointsPerVisit: 7, pointsPerSpendAmount: 100, pointsPerSpendPoints: 1 },
      ],
    });

    useCardBuilderStore.getState().setEarningMode('based_on_visits');

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    // 2026-09-09 mixed refactor: setEarningMode clears ALL earn rate fields
    // (pointsPerVisit + pointsPerSpend*) to avoid stale data on mode change.
    expect(tier.pointsPerVisit).toBeNull();
    expect(tier.pointsPerSpendAmount).toBeNull();
    expect(tier.pointsPerSpendPoints).toBeNull();
  });

  it('setEarningMode to the same mode is a no-op (no clear, rate fields untouched)', () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        { id: 'a', name: 'A', threshold: 100, rewardType: 'amount_off', rewardValue: 10, maxDiscountAmount: null, pointsPerVisit: 10 },
      ],
    });

    useCardBuilderStore.getState().setEarningMode('based_on_visits');

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerVisit).toBe(10);
  });

  it('updateRewardTier rejects pointsPerVisit < 1 (clamps / no-op)', () => {
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
    useCardBuilderStore.getState().updateRewardTier('a', { pointsPerVisit: 0 });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerVisit).toBe(10); // unchanged
  });

  it('updateRewardTier accepts valid pointsPerVisit (rounds to int)', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
        },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { pointsPerVisit: 12.7 });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerVisit).toBe(13);
  });

  it('updateRewardTier accepts valid pointsPerSpendAmount (rounds)', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
        },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { pointsPerSpendAmount: 100.5 });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerSpendAmount).toBe(100.5);
  });

  it('updateRewardTier rejects pointsPerSpendAmount ≤ 0', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerSpendAmount: 50,
        },
      ],
    });
    useCardBuilderStore.getState().updateRewardTier('a', { pointsPerSpendAmount: 0 });

    const tier = useCardBuilderStore.getState().rewardTiers[0]!;
    expect(tier.pointsPerSpendAmount).toBe(50); // unchanged
  });
});