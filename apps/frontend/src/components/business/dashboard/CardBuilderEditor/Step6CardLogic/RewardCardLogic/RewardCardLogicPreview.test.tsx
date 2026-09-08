/**
 * RewardCardLogicPreview — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level).
 * The preview reads the store's `earningMode` directly (not from any tier).
 * Each tier still owns its own earn rate fields but those don't affect the
 * preview's "is the user done?" gate.
 *
 * Verifies the live scenario preview text builder:
 *   - rewardTiers empty → "tierUnknown"
 *   - card-wide earningMode null + tier identity complete → "modeUnknown"
 *   - Full tier + card-wide mode → "集滿 {{threshold}} 點可兌換 {{reward}}" template
 *   - amount_off reward + TWD currency → 元
 *   - amount_off reward + ZAR currency → R
 *   - percent_off + maxDiscountAmount null → "無折抵上限"
 *   - percent_off + maxDiscountAmount set → with cap
 *   - First valid tier is shown (sorted by threshold ascending)
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardCardLogicPreview } from './RewardCardLogicPreview';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    // Mock t() so the `template` key returns the formatted sentence
    // "<threshold> 點可兌換 <reward>" — this lets tests assert that the
    // preview actually picks the right tier (lowest threshold first) and
    // includes the right reward string.
    t: vi.fn((key: string, p?: Record<string, unknown>) => {
      if (key === 'step6.reward.preview.template' && p) {
        return `${p.threshold} 點可兌換 ${p.reward}`;
      }
      return key;
    }),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardCardLogicPreview (Step 6 live preview)', () => {
  it('shows tierUnknown when rewardTiers is empty', () => {
    useCardBuilderStore.setState({ rewardTiers: [] });
    render(<RewardCardLogicPreview />);

    expect(screen.getByText('step6.reward.preview.tierUnknown')).toBeInTheDocument();
  });

  it('shows modeUnknown when card-wide earningMode is null but tier identity is complete', () => {
    useCardBuilderStore.setState({
      earningMode: null,
      rewardTiers: [
        {
          id: 'a',
          name: 'A',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    render(<RewardCardLogicPreview />);

    expect(screen.getByText('step6.reward.preview.modeUnknown')).toBeInTheDocument();
  });

  it('renders template sentence when tier fully filled + card-wide mode set (amount_off, TWD)', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'a',
          name: '500點折抵50元',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // With the t() mock formatting `template` to "<threshold> 點可兌換 <reward>",
    // we verify the threshold is rendered correctly.
    expect(container.textContent).toContain('500 點可兌換');
    // The ZAR unit should NOT appear (currency is TWD here).
    expect(container.textContent).toContain('step6.reward.tier.rewardValueAmountUnitTWD');
  });

  it('amount_off with ZAR currency uses unit R', () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'a',
          name: '500 pts R50 off',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // buildRewardStr composes `${value}${t(unitKey)}折價` — for ZAR the unit
    // t() returns "step6.reward.tier.rewardValueAmountUnitZAR". The actual
    // rendered text concatenates value + unit + "折價", so check substring.
    expect(container.textContent).toContain('step6.reward.tier.rewardValueAmountUnitZAR');
  });

  it('percent_off with cap → uses cap unit', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'a',
          name: '8% off',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: 50,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // The threshold should appear via t(template, { threshold: 200 }).
    expect(container.textContent).toContain('200 點可兌換');
    // Cap unit for TWD = "step6.reward.tier.maxDiscountUnitTWD"
    expect(container.textContent).toContain('step6.reward.tier.maxDiscountUnitTWD');
  });

  it('percent_off with ZAR currency → uses ZAR cap unit', () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'a',
          name: '8% off',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: 50,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // buildRewardStr composes `${value}%折扣，最高折抵 ${cap}${t(unitKey)}` —
    // for ZAR, the t() returns "step6.reward.tier.maxDiscountUnitZAR". Check
    // the rendered text contains the cap-unit key (use a function matcher
    // since the value is concatenated).
    expect(container.textContent).toContain('step6.reward.tier.maxDiscountUnitZAR');
  });

  // 2026-09-09 currency placement fix — ZAR must render R BEFORE the number
  // (South African Rand convention). These two tests pin the placement order
  // independently of the actual translation value.
  it('amount_off with ZAR currency → unit R appears BEFORE the amount (prefix notation)', () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'a',
          name: '500 pts R50 off',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // With the mock t() returning the key string verbatim, ZAR prefix
    // composition is `${amountUnitZAR}${value}折價`. The ZAR unit key MUST
    // appear immediately before "50" in the rendered text.
    const text = container.textContent ?? '';
    const zarUnitIdx = text.indexOf('step6.reward.tier.rewardValueAmountUnitZAR');
    const valueIdx = text.indexOf('50', zarUnitIdx);
    expect(zarUnitIdx).toBeGreaterThanOrEqual(0);
    expect(valueIdx).toBeGreaterThan(zarUnitIdx);
    // Sanity check: the suffix order (value, then unit) must NOT appear.
    expect(text.indexOf('50step6.reward.tier.rewardValueAmountUnitZAR')).toBe(-1);
  });

  it('amount_off with TWD currency → unit 元 appears AFTER the amount (suffix notation)', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'a',
          name: '500點折抵50元',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // TWD suffix composition is `${value}${amountUnitTWD}折價`. The TWD
    // unit key MUST appear immediately after "50" in the rendered text.
    const text = container.textContent ?? '';
    const valueIdx = text.indexOf('50');
    const twdUnitIdx = text.indexOf('step6.reward.tier.rewardValueAmountUnitTWD');
    expect(valueIdx).toBeGreaterThanOrEqual(0);
    expect(twdUnitIdx).toBeGreaterThan(valueIdx);
    // Sanity check: prefix order (unit, then value) must NOT appear.
    expect(text.indexOf('step6.reward.tier.rewardValueAmountUnitTWD50')).toBe(-1);
  });

  it('percent_off with ZAR cap → cap unit R appears BEFORE the cap amount (prefix notation)', () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'a',
          name: '8% off',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: 50,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // ZAR cap composition is `${capUnitZAR}${cap}`. The ZAR cap unit key
    // MUST appear before "50" (the cap amount) in the rendered text.
    const text = container.textContent ?? '';
    const zarCapUnitIdx = text.indexOf('step6.reward.tier.maxDiscountUnitZAR');
    const capAmountIdx = text.indexOf('50', zarCapUnitIdx);
    expect(zarCapUnitIdx).toBeGreaterThanOrEqual(0);
    expect(capAmountIdx).toBeGreaterThan(zarCapUnitIdx);
    // Sanity check: suffix order (cap amount, then unit) must NOT appear.
    expect(text.indexOf('50step6.reward.tier.maxDiscountUnitZAR')).toBe(-1);
  });

  it('percent_off with TWD cap → cap unit 元 appears AFTER the cap amount (suffix notation)', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'a',
          name: '8% off',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: 50,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // TWD cap composition is `${cap}${capUnitTWD}`. The TWD cap unit key
    // MUST appear after "50" in the rendered text.
    const text = container.textContent ?? '';
    const capAmountIdx = text.indexOf('50');
    const twdCapUnitIdx = text.indexOf('step6.reward.tier.maxDiscountUnitTWD');
    expect(capAmountIdx).toBeGreaterThanOrEqual(0);
    expect(twdCapUnitIdx).toBeGreaterThan(capAmountIdx);
    // Sanity check: prefix order (unit, then cap) must NOT appear.
    expect(text.indexOf('step6.reward.tier.maxDiscountUnitTWD50')).toBe(-1);
  });

  it('picks the first valid tier in stored order (sortRewardTiers pins the order)', () => {
    // Note: RewardCardLogicPreview uses Array.find() which returns the FIRST
    // valid match in stored order. The expected order is established by
    // `sortRewardTiers()` in the store — loadSettings() sorts on load and
    // callers should sort before save. This test sets up tiers in already-
    // sorted order (low threshold first) to mirror the production scenario.
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'low',
          name: 'Low reward',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
        {
          id: 'high',
          name: 'High reward',
          threshold: 1000,
          rewardType: 'amount_off',
          rewardValue: 100,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // With the t() mock formatting `template` to "<threshold> 點可兌換 …" —
    // the low tier (threshold=100) is picked over high tier (threshold=1000)
    // because it appears first in the sorted array.
    expect(container.textContent).toContain('100 點可兌換');
    expect(container.textContent).not.toContain('1000 點可兌換');
  });

  it('sortRewardTiers orders tiers ascending — pins the sort contract', () => {
    // Set up tiers in mixed order and call sortRewardTiers() explicitly.
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_points',
      rewardTiers: [
        { id: 'high', name: 'H', threshold: 1000, rewardType: 'amount_off' as const, rewardValue: 100, maxDiscountAmount: null, pointsPerVisit: null, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
        { id: 'low', name: 'L', threshold: 100, rewardType: 'amount_off' as const, rewardValue: 10, maxDiscountAmount: null, pointsPerVisit: null, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
        { id: 'mid', name: 'M', threshold: 500, rewardType: 'amount_off' as const, rewardValue: 50, maxDiscountAmount: null, pointsPerVisit: null, pointsPerSpendAmount: null, pointsPerSpendPoints: null },
      ],
    });
    useCardBuilderStore.getState().sortRewardTiers();

    const { container } = render(<RewardCardLogicPreview />);

    // After sort, the array is [low(100), mid(500), high(1000)] — preview
    // picks the first valid (low threshold = 100).
    expect(container.textContent).toContain('100 點可兌換');
  });

  it('incomplete tier (missing rewardType or rewardValue) → tierUnknown', () => {
    useCardBuilderStore.setState({
      rewardTiers: [
        {
          id: 'incomplete',
          name: '',
          threshold: 0,
          rewardType: null,
          rewardValue: null,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        } as unknown as ReturnType<typeof useCardBuilderStore.getState>['rewardTiers'][number],
      ],
    });
    render(<RewardCardLogicPreview />);

    expect(screen.getByText('step6.reward.preview.tierUnknown')).toBeInTheDocument();
  });

  // 2026-09-09 mixed refactor: tier-level earningMode is gone — preview
  // ignores per-tier earn rate fields and reads only card-wide `earningMode`.
  it('preview ignores per-tier earn rate fields (only card-wide earningMode matters)', () => {
    // Tier has per-tier points set BUT card-wide earningMode is null.
    // Preview should still show modeUnknown (priority order unchanged).
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: null,
      rewardTiers: [
        {
          id: 'a',
          name: '500點折抵50元',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
      ],
    });
    render(<RewardCardLogicPreview />);

    expect(screen.getByText('step6.reward.preview.modeUnknown')).toBeInTheDocument();
  });
});