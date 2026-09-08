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

  it('renders with 2026-09-09 compact copy', () => {
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    expect(screen.getByText('step6.reward.pointsPerSpend.title')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerSpend.amountLabel')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.pointsPerSpend.amountPlaceholder'),
    ).toBeInTheDocument();
    // 2026-09-09 2nd-pass: equalLabel + earnLabel merged into equalEarnLabel
    expect(screen.getByText('step6.reward.pointsPerSpend.equalEarnLabel')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerSpend.pointsLabel')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.pointsPerSpend.pointsPlaceholder'),
    ).toBeInTheDocument();
  });

  it('renders the merged "=獲得" label as a single span (not separate equalLabel + earnLabel spans)', () => {
    const tierId = seedTier('based_on_spending');
    const { container } = render(
      <PointsPerSpendField showValidation={false} tierId={tierId} />,
    );

    // The single i18n key `equalEarnLabel` must be rendered as one <span>.
    // The previous equalLabel/earnLabel split (with gap-x-1.5 between them)
    // produced a visible "= 獲得" with extra space, which the user
    // explicitly asked to compact to "=獲得" on mobile.
    const mergedSpans = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === 'step6.reward.pointsPerSpend.equalEarnLabel',
    );
    expect(mergedSpans.length).toBe(1);

    // equalLabel / earnLabel must NOT be rendered as standalone spans any
    // more (they were merged into equalEarnLabel in 2026-09-09 2nd pass).
    const obsoleteEqual = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === 'step6.reward.pointsPerSpend.equalLabel',
    );
    const obsoleteEarn = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === 'step6.reward.pointsPerSpend.earnLabel',
    );
    expect(obsoleteEqual.length).toBe(0);
    expect(obsoleteEarn.length).toBe(0);
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

  it('mobile regression 2026-09-09: "每消費" label sits in SAME phrase-row as amount input', () => {
    const tierId = seedTier('based_on_spending');
    render(<PointsPerSpendField showValidation={false} tierId={tierId} />);

    // Mock t() returns the key verbatim, so `getByText('step6.reward...amountLabel')`
    // resolves the "每消費" label and `getByLabelText(...)` resolves the input
    // sharing the SAME aria-label.
    const amountLabel = screen.getByText('step6.reward.pointsPerSpend.amountLabel');
    const amountInput = screen.getByLabelText(
      'step6.reward.pointsPerSpend.amountLabel',
    );

    // Mobile fix: the label and the amount input are now SIBLINGS inside ONE
    // semantic phrase-row container, so the input doesn't break onto its own
    // line (regression — each fragment used to be a top-level flex child of
    // the outer flex-col, so "每消費" / "R" / "200" / "元" / "=" / "獲得" /
    // "2" / "個點數" all stacked vertically as 8 separate lines).
    expect(amountLabel.parentElement).toBe(amountInput.parentElement);
  });

  it('mobile regression 2026-09-09: amount and points live in DIFFERENT phrase-row containers', () => {
    const tierId = seedTier('based_on_spending');
    const { container } = render(
      <PointsPerSpendField showValidation={false} tierId={tierId} />,
    );

    const amountInput = container.querySelector<HTMLInputElement>(
      `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
    );
    const pointsInput = container.querySelector<HTMLInputElement>(
      `input[id="step6-tier-${tierId}-points-per-spend-points"]`,
    );
    expect(amountInput).not.toBeNull();
    expect(pointsInput).not.toBeNull();

    // Mobile (jsdom default = no media query applied): each input lives in
    // its own semantic phrase-row container ("每消費 [N] 元" / "= 獲得 [M] 個點數").
    // Their parents must be DIFFERENT (one per phrase).
    const amountParent = amountInput!.parentElement!;
    const pointsParent = pointsInput!.parentElement!;
    expect(amountParent).not.toBe(pointsParent);

    // But both phrase-row containers share the SAME grandparent — the outer
    // container that drives mobile=vertical / md+ horizontal layout.
    expect(amountParent.parentElement).toBe(pointsParent.parentElement);
  });

  it('md+ viewport: amount + points share a GRANDPARENT row container; each phrase-row uses md:contents to flatten (2026-09-09 mobile-fix layout)', () => {
    const tierId = seedTier('based_on_spending');
    const { container } = render(
      <PointsPerSpendField showValidation={false} tierId={tierId} />,
    );

    const amountInput = container.querySelector<HTMLInputElement>(
      `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
    );
    const pointsInput = container.querySelector<HTMLInputElement>(
      `input[id="step6-tier-${tierId}-points-per-spend-points"]`,
    );
    expect(amountInput).not.toBeNull();
    expect(pointsInput).not.toBeNull();

    // After the 2026-09-09 mobile fix, inputs live in DIFFERENT phrase-row
    // containers (one per logical phrase). Both phrase-row containers share
    // the SAME grandparent row, which is the outer container.
    const amountParent = amountInput!.parentElement!;
    const pointsParent = pointsInput!.parentElement!;
    expect(amountParent).not.toBe(pointsParent);
    expect(amountParent.parentElement).toBe(pointsParent.parentElement);

    // Each phrase-row inner container uses `md:contents` (display: contents
    // at md+) so the children get hoisted into the outer container at md+
    // screens — visually the whole sentence still reads as a single
    // horizontal row, despite the DOM having a deeper tree.
    expect(amountParent.className).toContain('md:contents');
    expect(pointsParent.className).toContain('md:contents');

    // Outer container keeps the mobile-first → md+ enhancement pattern.
    const outer = amountParent.parentElement!;
    expect(outer.className).toContain('flex-col');
    expect(outer.className).toContain('md:flex-row');
  });

  // 2026-09-09 2nd-pass mobile polish: previous fix used `w-full md:w-24`
  // for the amount input and `w-full md:w-20` for the points input. On
  // mobile that forced each input to claim the full container width —
  // pushing labels and units onto separate lines. The user asked us to
  // compact the inputs so the whole phrase fits on one line:
  //   每消費 [input] 元       (single line on mobile)
  //   =獲得 [input] 個點數    (single line on mobile)
  describe('mobile compact-width (2026-09-09 2nd-pass polish)', () => {
    it('amount input is compact on BOTH breakpoints — not full-width on mobile', () => {
      const tierId = seedTier('based_on_spending');
      const { container } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );

      const input = container.querySelector<HTMLInputElement>(
        `input[id="step6-tier-${tierId}-points-per-spend-amount"]`,
      )!;
      // Mobile fix: no `w-full` class — input is fixed width on mobile too
      // so labels + unit can fit on the same line.
      expect(input.className).not.toMatch(/\bw-full\b/);
      // Tailwind w-24 = 96px (6rem). Verify the class is present.
      expect(input.className).toMatch(/\bw-24\b/);
    });

    it('points input is compact on BOTH breakpoints — not full-width on mobile', () => {
      const tierId = seedTier('based_on_spending');
      const { container } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );

      const input = container.querySelector<HTMLInputElement>(
        `input[id="step6-tier-${tierId}-points-per-spend-points"]`,
      )!;
      expect(input.className).not.toMatch(/\bw-full\b/);
      // Tailwind w-20 = 80px (5rem). Verify the class is present.
      expect(input.className).toMatch(/\bw-20\b/);
    });

    it('phrase row 2 (earned points) carries NO mobile indent — labels and unit start at left margin', () => {
      const tierId = seedTier('based_on_spending');
      const { container } = render(
        <PointsPerSpendField showValidation={false} tierId={tierId} />,
      );

      const pointsInput = container.querySelector<HTMLInputElement>(
        `input[id="step6-tier-${tierId}-points-per-spend-points"]`,
      )!;
      const pointsRow = pointsInput.parentElement!;

      // Previous fix added `pl-4 md:pl-0` to visually indent the result
      // phrase ("this is the result of row 1"). With the new compact
      // mobile layout — both rows now start at the left margin and
      // each row fits on one line — the indent is no longer needed
      // and was removed.
      expect(pointsRow.className).not.toMatch(/\bpl-4\b/);
      // `md:contents` still applies so the row flattens on md+.
      expect(pointsRow.className).toContain('md:contents');
    });
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