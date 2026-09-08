/**
 * PointsPerSpendField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 mixed refactor: this field is INSIDE each RewardTierRow
 * (per-tier earn rate), but its conditional render is now driven by the
 * CARD-WIDE `earningMode` (top-level) — NOT `tier.earningMode`.
 * Read/write goes through
 * `updateRewardTier(tierId, { pointsPerSpendAmount })` and
 * `updateRewardTier(tierId, { pointsPerSpendPoints })`.
 *
 * 2026-09-09 copy update: the field reads
 *   "每消費 [N] 元 = 獲得 [M] 個點數"
 * with placeholders "例如：100" and "例如：1". The previous copy ("元獲得")
 * was unclear and has been removed.
 *
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention; TWD keeps suffix
 * (元 after) per zh-TW convention. The render pins the unit position
 * relative to the input element.
 *
 * Verifies:
 *   - Renders ONLY when card-wide `earningMode === 'based_on_spending'`.
 *   - Returns null for other card-wide earningModes (hidden).
 *   - Returns null when tierId is not in store.
 *   - Two inputs: amountLabel + amountPlaceholder (currency amount) +
 *     pointsPlaceholder (points earned).
 *   - Updates tier.pointsPerSpendAmount / tier.pointsPerSpendPoints on change.
 *   - showValidation=true + either null → renders requiredError.
 *   - TWD currency → unit 元 appears AFTER the input.
 *   - ZAR currency → unit R appears BEFORE the input.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointsPerSpendField } from './PointsPerSpendField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

/**
 * 2026-09-09 mixed refactor: earningMode is CARD-WIDE.
 * Tests seed the top-level `earningMode` and per-tier
 * `pointsPerSpendAmount` / `pointsPerSpendPoints`.
 */
function seedTier(
  earningMode: 'based_on_points' | 'based_on_visits' | 'based_on_spending' | null = 'based_on_spending',
  pointsPerSpendAmount: number | null = null,
  pointsPerSpendPoints: number | null = null,
) {
  useCardBuilderStore.getState().setEarningMode(earningMode);
  useCardBuilderStore.getState().addRewardTier();
  const tier = useCardBuilderStore.getState().rewardTiers[0]!;
  tier.pointsPerSpendAmount = pointsPerSpendAmount;
  tier.pointsPerSpendPoints = pointsPerSpendPoints;
  useCardBuilderStore.setState({ rewardTiers: [...useCardBuilderStore.getState().rewardTiers] });
  return tier.id;
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('PointsPerSpendField (per-tier rate, Step 6 section 2b — CONDITIONAL on card-wide earningMode)', () => {
  it('returns null when tierId is not in store', () => {
    useCardBuilderStore.getState().setEarningMode('based_on_spending');
    const { container } = render(
      <PointsPerSpendField showValidation={false} tierId="nonexistent" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is null', () => {
    const tierId = seedTier(null);
    const { container } = render(<PointsPerSpendField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is based_on_points', () => {
    const tierId = seedTier('based_on_points');
    const { container } = render(<PointsPerSpendField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is based_on_visits', () => {
    const tierId = seedTier('based_on_visits');
    const { container } = render(<PointsPerSpendField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when card-wide earningMode is based_on_spending (with 2026-09-09 copy)', () => {
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    expect(screen.getByText('step6.reward.pointsPerSpend.title')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerSpend.amountLabel')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.pointsPerSpend.amountPlaceholder'),
    ).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerSpend.earnLabel')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerSpend.pointsLabel')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.pointsPerSpend.pointsPlaceholder'),
    ).toBeInTheDocument();
  });

  it('renders equal label (=) between amount row and points row', () => {
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    expect(screen.getByText('step6.reward.pointsPerSpend.equalLabel')).toBeInTheDocument();
  });

  it('updates tier.pointsPerSpendAmount on valid input', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerSpend.amountLabel') as HTMLInputElement;
    await user.type(input, '100');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerSpendAmount).toBe(100);
  });

  it('updates tier.pointsPerSpendPoints on valid input', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerSpend.pointsLabel') as HTMLInputElement;
    await user.type(input, '1');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerSpendPoints).toBe(1);
  });

  it('empty amount input sets tier.pointsPerSpendAmount = null', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_spending', 100);
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerSpend.amountLabel') as HTMLInputElement;
    await user.clear(input);

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerSpendAmount).toBeNull();
  });

  it('showValidation=true + amount null → renders requiredError', () => {
    const tierId = seedTier('based_on_spending', null, 1);
    render(<PointsPerSpendField showValidation={true} tierId={tierId} />);

    expect(
      screen.getByText('step6.reward.pointsPerSpend.requiredError'),
    ).toBeInTheDocument();
  });

  it('showValidation=true + points null → renders requiredError', () => {
    const tierId = seedTier('based_on_spending', 100, null);
    render(<PointsPerSpendField showValidation={true} tierId={tierId} />);

    expect(
      screen.getByText('step6.reward.pointsPerSpend.requiredError'),
    ).toBeInTheDocument();
  });

  it('showValidation=true + both filled → no error message', () => {
    const tierId = seedTier('based_on_spending', 100, 1);
    render(<PointsPerSpendField showValidation={true} tierId={tierId} />);

    expect(
      screen.queryByText('step6.reward.pointsPerSpend.requiredError'),
    ).not.toBeInTheDocument();
  });

  // 2026-09-09 currency placement fix — TWD keeps 元 as suffix; ZAR uses R
  // as prefix (South African Rand convention). These two tests pin the
  // unit position relative to the input element.
  describe('currency-aware unit placement (2026-09-09)', () => {
    it('TWD currency → unit 元 rendered AFTER the amount input (suffix notation)', () => {
      const tierId = seedTier('based_on_spending');
      const { container } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );

      // The mock t() returns the key string verbatim, so the rendered
      // text contains the literal i18n key. We assert the input element
      // appears BEFORE the TWD unit key in DOM order.
      const input = container.querySelector(
        `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
      );
      expect(input).not.toBeNull();

      // The TWD unit key should appear in the DOM AFTER the input.
      // Walk through sibling spans to verify.
      const row = input!.closest('div')!;
      const children = Array.from(row.children);
      const inputIdx = children.indexOf(input as Element);
      // Find which sibling (if any) renders the TWD unit key.
      const twdUnitIdx = children.findIndex((el, idx) =>
        idx > inputIdx && (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitTWD',
      );
      expect(twdUnitIdx).toBeGreaterThan(inputIdx);

      // ZAR unit key must NOT appear when currency is TWD.
      const zarUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitZAR',
      );
      expect(zarUnitIdx).toBe(-1);
    });

    it('ZAR currency → unit R rendered BEFORE the amount input (prefix notation)', () => {
      useCardBuilderStore.getState().setCurrency('ZAR');
      const tierId = seedTier('based_on_spending');
      const { container } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );

      // For ZAR, the ZAR unit key should appear in the DOM BEFORE the input.
      const input = container.querySelector(
        `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
      );
      expect(input).not.toBeNull();

      const row = input!.closest('div')!;
      const children = Array.from(row.children);
      const inputIdx = children.indexOf(input as Element);
      // Find which sibling (if any) renders the ZAR unit key BEFORE the input.
      const zarUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitZAR',
      );
      expect(zarUnitIdx).toBeGreaterThanOrEqual(0);
      expect(zarUnitIdx).toBeLessThan(inputIdx);

      // TWD unit key must NOT appear when currency is ZAR.
      const twdUnitIdx = children.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitTWD',
      );
      expect(twdUnitIdx).toBe(-1);
    });

    it('switching currency from TWD to ZAR moves unit from suffix to prefix position', () => {
      // Start in TWD (default after reset).
      const tierId = seedTier('based_on_spending');
      const { container, rerender } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );
      const input = container.querySelector(
        `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
      );
      const twdRow = input!.closest('div')!;
      const twdChildren = Array.from(twdRow.children);
      const twdInputIdx = twdChildren.indexOf(input as Element);
      expect(
        twdChildren.findIndex(
          (el) => (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitTWD',
        ),
      ).toBeGreaterThan(twdInputIdx);

      // Switch to ZAR and re-render.
      useCardBuilderStore.getState().setCurrency('ZAR');
      rerender(<PointsPerSpendField showValidation={false} tierId={tierId} />);

      const zarInput = container.querySelector(
        `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
      );
      const zarRow = zarInput!.closest('div')!;
      const zarChildren = Array.from(zarRow.children);
      const zarInputIdx = zarChildren.indexOf(zarInput as Element);
      const zarUnitIdx = zarChildren.findIndex(
        (el) => (el as HTMLElement).textContent === 'step6.reward.pointsPerSpend.amountUnitZAR',
      );
      expect(zarUnitIdx).toBeGreaterThanOrEqual(0);
      expect(zarUnitIdx).toBeLessThan(zarInputIdx);
    });
  });
});