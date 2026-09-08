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
    // Mock t() so:
    //   - `template` returns "<threshold> 點可兌換 <reward>" (full sentence)
    //   - reward-fragment keys (amountReward / percentReward / amountWithCap
    //     / percentWithCap / percentNoCap) substitute `{{amount}}` /
    //     `{{percent}}` / `{{cap}}` placeholders by simple replacement.
    //   - unit keys (rewardValueAmountUnitTWD / rewardValueAmountUnitZAR /
    //     maxDiscountUnitTWD / maxDiscountUnitZAR) return a literal symbol
    //     so formatAmount() produces a real "50元" / "R50" amount string.
    // This lets tests assert that the preview actually picks the right tier
    // (lowest threshold first) and includes the right reward string.
    //
    // 2026-09-09 update: the reward-fragment keys are now real i18n keys
    // (instead of hardcoded Chinese fragments). The mock substitutes
    // `{{var}}` placeholders so tests can assert on the actual rendered
    // reward text, not just the raw key.
    t: vi.fn((key: string, p?: Record<string, unknown>) => {
      if (key === 'step6.reward.preview.template' && p) {
        return `${p.threshold} 點可兌換 ${p.reward}`;
      }
      // Simple {{var}} substitution for reward-fragment keys.
      if (
        key === 'step6.reward.preview.amountReward' ||
        key === 'step6.reward.preview.percentReward' ||
        key === 'step6.reward.preview.amountWithCap' ||
        key === 'step6.reward.preview.percentWithCap' ||
        key === 'step6.reward.preview.percentNoCap'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lookup: Record<string, string> = {
          amountReward: '{{amount}}折價',
          percentReward: '{{percent}}%折扣',
          amountWithCap: '{{amount}}折價，最高折抵 {{cap}}',
          percentWithCap: '{{percent}}%折扣，最高折抵 {{cap}}',
          percentNoCap: '{{percent}}%折扣，無折抵上限',
        };
        const tmpl = lookup[key.split('.').pop() as keyof typeof lookup];
        if (!tmpl) return key;
        return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
          p && k in p ? String(p[k]) : `{{${k}}}`,
        );
      }
      // Currency unit resolution (2026-09-09): formatAmount() reads these
      // keys to compose the amount string before passing it as {{amount}}
      // to the template above. The mock returns the literal symbol so the
      // amount string is a real "50元" / "R50" — not the raw i18n key.
      const unitLookup: Record<string, string> = {
        'step6.reward.tier.rewardValueAmountUnitTWD': '元',
        'step6.reward.tier.rewardValueAmountUnitZAR': 'R',
        'step6.reward.tier.maxDiscountUnitTWD': '元',
        'step6.reward.tier.maxDiscountUnitZAR': 'R',
      };
      if (key in unitLookup) return unitLookup[key];
      return key;
    }),
    // 2026-09-09: formatAmount() reads i18n.language to decide suffix vs
    // prefix placement. Default mock = 'zh-TW' (matches the zh-TW test
    // scenarios); individual tests can override via
    // useTranslation.mockReturnValue(...) if they need 'en' behaviour.
    i18n: { language: 'zh-TW' },
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
    // the threshold appears in the sentence.
    expect(container.textContent).toContain('500 點可兌換');
    // Reward fragment is now routed through t('step6.reward.preview.amountReward')
    // with `amount: formatAmount(50)` = `50元` (TWD zh-TW suffix).
    expect(container.textContent).toContain('50元折價');
    // Sanity check: ZAR prefix pattern must NOT appear in the TWD render.
    expect(container.textContent).not.toContain('R50折價');
  });

  it('amount_off with ZAR currency uses prefix R (zh-TW locale)', () => {
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

    // 2026-09-09 i18n fix: ZAR is always prefix regardless of locale.
    // formatAmount(50) for ZAR = `R50`. Reward fragment becomes `R50折價`.
    expect(container.textContent).toContain('R50折價');
    // Sanity check: suffix pattern must NOT appear.
    expect(container.textContent).not.toContain('50R折價');
    expect(container.textContent).not.toContain('50元折價');
  });

  it('percent_off with TWD cap → suffix notation', () => {
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

    // 2026-09-09 i18n fix: percentWithCap key substitutes {{percent}} and
    // {{cap}}; cap comes pre-formatted with the currency unit.
    // TWD zh-TW suffix → cap becomes `50元`.
    expect(container.textContent).toContain('8%折扣，最高折抵 50元');
    // Threshold should still appear via t(template, { threshold: 200 }).
    expect(container.textContent).toContain('200 點可兌換');
  });

  it('percent_off with ZAR cap → prefix notation (R before amount)', () => {
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

    // 2026-09-09 i18n fix: ZAR is prefix-only regardless of locale. cap
    // becomes `R50` and the reward fragment renders as `8%折扣，最高折抵 R50`.
    expect(container.textContent).toContain('8%折扣，最高折抵 R50');
    // Sanity check: suffix 元 must NOT appear with the ZAR cap.
    expect(container.textContent).not.toContain('最高折抵 50元');
  });

  // 2026-09-09 placement regression tests — pin the position of the
  // currency unit relative to the amount in BOTH the amount_off reward
  // string AND the percent_off cap string.
  it('amount_off + TWD zh-TW → unit 元 is AFTER the amount (suffix)', () => {
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

    const text = container.textContent ?? '';
    // TWD zh-TW suffix: 50 must appear immediately before 元.
    expect(text).toContain('50元');
    // Sanity: prefix order (元, then value) must NOT appear.
    expect(text).not.toMatch(/元50/);
  });

  it('amount_off + ZAR (any locale) → unit R is BEFORE the amount (prefix)', () => {
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

    const text = container.textContent ?? '';
    // ZAR prefix: R must appear immediately before 50.
    expect(text).toContain('R50');
    // Sanity: suffix order (value, then R) must NOT appear in the reward.
    // Allow "50R" only if it's not part of a number followed by R as currency.
    expect(text).not.toMatch(/(?<![\d])50R/);
  });

  it('percent_off + TWD zh-TW → cap unit 元 is AFTER the cap amount (suffix)', () => {
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

    const text = container.textContent ?? '';
    // TWD zh-TW suffix: 50 must appear immediately before 元 in the cap phrase.
    expect(text).toContain('最高折抵 50元');
    // Sanity: prefix order (元, then value) must NOT appear in the cap.
    expect(text).not.toMatch(/元50/);
  });

  it('percent_off + ZAR (any locale) → cap unit R is BEFORE the cap amount (prefix)', () => {
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

    const text = container.textContent ?? '';
    // ZAR prefix: R must appear immediately before 50 in the cap phrase.
    expect(text).toContain('最高折抵 R50');
    // Sanity: suffix order (cap value, then R) must NOT appear.
    expect(text).not.toMatch(/(?<![\d])50R/);
  });

  it('percent_off with NO cap → renders percentNoCap template (no max fragment)', () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'a',
          name: '8% off no cap',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    // 2026-09-09 i18n fix: percentNoCap template substitutes {{percent}}.
    expect(container.textContent).toContain('8%折扣，無折抵上限');
    // Sanity: cap phrase must NOT appear when maxDiscountAmount is null.
    expect(container.textContent).not.toContain('最高折抵');
  });

  it('regression — preview output contains NO raw Chinese fragments when only English keys are translated', () => {
    // 2026-09-09 regression for the mixed-language bleed:
    // "Earn 1500 points to redeem 20%折扣，最高折抵 R50" was the bug report
    // — zh-TW fragments leaking into the en render. Pin that the preview
    // routes EVERY phrase through i18n by:
    //   1. The amount string includes the currency unit via the unit key
    //      (regression: the bug was "20%" without a unit symbol, since
    //      the unit was injected only for amount_off / cap, not the
    //      percent value itself).
    //   2. The reward phrase comes from the i18n template, which only
    //      contains locale-correct Chinese in zh-TW — so for an en
    //      render the phrase would be "R20 off" instead of "R20折價".
    //   3. The threshold phrase comes from `template`, which (for en)
    //      would be "Earn 1500 points to redeem …" instead of
    //      "集滿 1500 點可兌換 …".
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'a',
          name: '1500 pts R50 off',
          threshold: 1500,
          rewardType: 'amount_off',
          rewardValue: 20,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    const { container } = render(<RewardCardLogicPreview />);

    const text = container.textContent ?? '';
    // Currency unit placement: R must prefix the value (R20).
    expect(text).toContain('R20');
    // The reward fragment now comes from the amountReward i18n template,
    // which (under the zh-TW mock) is "{{amount}}折價" — the formatted
    // amount string "R20" gets interpolated into the template, producing
    // the locale-correct phrase.
    expect(text).toContain('R20折價');
    // The threshold phrase comes from `template`, which the mock formats
    // as "<threshold> 點可兌換 <reward>". No raw i18n key should leak into
    // the rendered output.
    expect(text).not.toContain('step6.reward.preview.amountReward');
    expect(text).not.toContain('step6.reward.preview.template');
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