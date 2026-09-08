/**
 * PointsPerVisitField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 mixed refactor: this field is INSIDE each RewardTierRow
 * (per-tier earn rate), but its conditional render is now driven by the
 * CARD-WIDE `earningMode` (top-level) — NOT `tier.earningMode`. Read/write
 * goes through `updateRewardTier(tierId, { pointsPerVisit })`.
 *
 * Verifies:
 *   - Renders ONLY when card-wide `earningMode === 'based_on_visits'`.
 *   - Returns null for other card-wide earningModes (hidden).
 *   - Returns null when tierId is not in store.
 *   - Updates `tier.pointsPerVisit` on change.
 *   - Empty input → tier.pointsPerVisit = null.
 *   - showValidation=true + null → renders requiredError.
 *   - showValidation=false + null → no error message.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointsPerVisitField } from './PointsPerVisitField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

/**
 * 2026-09-09 mixed refactor: earningMode is CARD-WIDE.
 * Tests seed the top-level `earningMode` and per-tier `pointsPerVisit`
 * (no per-tier earningMode).
 */
function seedTier(earningMode: 'based_on_points' | 'based_on_visits' | 'based_on_spending' | null = 'based_on_visits',
  pointsPerVisit: number | null = null) {
  useCardBuilderStore.getState().setEarningMode(earningMode);
  useCardBuilderStore.getState().addRewardTier();
  const tier = useCardBuilderStore.getState().rewardTiers[0]!;
  tier.pointsPerVisit = pointsPerVisit;
  useCardBuilderStore.setState({ rewardTiers: [...useCardBuilderStore.getState().rewardTiers] });
  return tier.id;
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('PointsPerVisitField (per-tier rate, Step 6 section 2, CONDITIONAL on card-wide earningMode)', () => {
  it('returns null when tierId is not in store', () => {
    useCardBuilderStore.getState().setEarningMode('based_on_visits');
    const { container } = render(
      <PointsPerVisitField showValidation={false} tierId="nonexistent" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is null', () => {
    const tierId = seedTier(null);
    const { container } = render(<PointsPerVisitField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is based_on_points', () => {
    const tierId = seedTier('based_on_points');
    const { container } = render(<PointsPerVisitField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when card-wide earningMode is based_on_spending', () => {
    const tierId = seedTier('based_on_spending');
    const { container } = render(<PointsPerVisitField showValidation={false} tierId={tierId} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when card-wide earningMode is based_on_visits', () => {
    const tierId = seedTier('based_on_visits');
    render(<PointsPerVisitField showValidation={false} tierId={tierId} />);

    expect(screen.getByText('step6.reward.pointsPerVisit.title')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('step6.reward.pointsPerVisit.placeholder'),
    ).toBeInTheDocument();
    expect(screen.getByText('step6.reward.pointsPerVisit.unit')).toBeInTheDocument();
  });

  it('updates tier.pointsPerVisit on valid input', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_visits');
    render(<PointsPerVisitField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerVisit.title') as HTMLInputElement;
    await user.type(input, '15');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerVisit).toBe(15);
  });

  it('empty input sets tier.pointsPerVisit = null', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_visits', 10);
    render(<PointsPerVisitField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerVisit.title') as HTMLInputElement;
    await user.clear(input);

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerVisit).toBeNull();
  });

  it('rejects input < 1 (does not update tier.pointsPerVisit)', async () => {
    const user = userEvent.setup();
    const tierId = seedTier('based_on_visits', null);
    render(<PointsPerVisitField showValidation={false} tierId={tierId} />);

    const input = screen.getByLabelText('step6.reward.pointsPerVisit.title') as HTMLInputElement;
    await user.clear(input);
    input.focus();
    await user.paste('0');

    const tier = useCardBuilderStore.getState().rewardTiers.find((t) => t.id === tierId)!;
    expect(tier.pointsPerVisit).toBeNull();
  });

  it('showValidation=true + null → renders requiredError', () => {
    const tierId = seedTier('based_on_visits', null);
    render(<PointsPerVisitField showValidation={true} tierId={tierId} />);

    expect(
      screen.getByText('step6.reward.pointsPerVisit.requiredError'),
    ).toBeInTheDocument();
  });

  it('showValidation=false + null → no error message', () => {
    const tierId = seedTier('based_on_visits', null);
    render(<PointsPerVisitField showValidation={false} tierId={tierId} />);

    expect(
      screen.queryByText('step6.reward.pointsPerVisit.requiredError'),
    ).not.toBeInTheDocument();
  });
});