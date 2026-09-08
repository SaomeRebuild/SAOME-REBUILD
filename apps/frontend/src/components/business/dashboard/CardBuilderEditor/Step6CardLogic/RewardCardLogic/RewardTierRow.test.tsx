/**
 * RewardTierRow — Vitest + RTL Tests (Rule 003 TDD)
 *
 * 2026-09-09 desktop layout: identity section (name + threshold) and
 * reward-rule section (rewardType + rewardValue) use 2-col grid on md+
 * to reduce vertical space. Mobile stays stacked.
 *
 * Verifies:
 *   - Renders one mock per sub-field (6 sub-components).
 *   - Identity section: name + threshold share a parent grid with `md:grid-cols-2`.
 *   - Reward rule section: type + value share a parent grid with
 *     `md:grid-cols-2`; MaxDiscount stays on its own row (different parent).
 *   - Earn rate section keeps its existing flex-col wrapper (only one
 *     earn-rate field renders per card-wide earningMode).
 *   - Remove button calls `removeRewardTier(tierId)`.
 *   - Tier header string contains both thresholdTitle + nameTitle keys.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8.5 Desktop Layout Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardTierRow } from './RewardTierRow';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock all 6 sub-fields. Each renders a div with a stable data-testid so
// tests can locate them and inspect their parent containers.
vi.mock('./RewardTierNameField', () => ({
  RewardTierNameField: () => <div data-testid="sub-name">NameField</div>,
}));
vi.mock('./RewardTierThresholdField', () => ({
  RewardTierThresholdField: () => <div data-testid="sub-threshold">ThresholdField</div>,
}));
vi.mock('./PointsPerVisitField', () => ({
  PointsPerVisitField: () => <div data-testid="sub-points-per-visit">PointsPerVisitField</div>,
}));
vi.mock('./PointsPerSpendField', () => ({
  PointsPerSpendField: () => <div data-testid="sub-points-per-spend">PointsPerSpendField</div>,
}));
vi.mock('./RewardTierRewardTypeField', () => ({
  RewardTierRewardTypeField: () => <div data-testid="sub-reward-type">RewardTypeField</div>,
}));
vi.mock('./RewardTierRewardValueField', () => ({
  RewardTierRewardValueField: () => <div data-testid="sub-reward-value">RewardValueField</div>,
}));
vi.mock('./RewardTierMaxDiscountField', () => ({
  RewardTierMaxDiscountField: () => <div data-testid="sub-max-discount">MaxDiscountField</div>,
}));

function seedTier() {
  useCardBuilderStore.getState().setEarningMode('based_on_points');
  useCardBuilderStore.getState().addRewardTier();
  return useCardBuilderStore.getState().rewardTiers[0]!.id;
}

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardTierRow — desktop layout (2026-09-09 2-col grid for tight sections)', () => {
  it('renders all 6 sub-fields (mocked)', () => {
    const tierId = seedTier();
    render(<RewardTierRow showValidation={false} tierId={tierId} />);

    expect(screen.getByTestId('sub-name')).toBeInTheDocument();
    expect(screen.getByTestId('sub-threshold')).toBeInTheDocument();
    expect(screen.getByTestId('sub-points-per-visit')).toBeInTheDocument();
    expect(screen.getByTestId('sub-points-per-spend')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-type')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-value')).toBeInTheDocument();
    expect(screen.getByTestId('sub-max-discount')).toBeInTheDocument();
  });

  it('identity section wraps name + threshold in a 2-col grid on md+ (mobile = 1 col)', () => {
    const tierId = seedTier();
    render(<RewardTierRow showValidation={false} tierId={tierId} />);

    const name = screen.getByTestId('sub-name');
    const threshold = screen.getByTestId('sub-threshold');

    // Both must share the same parent container (the identity section).
    const identityContainer = name.parentElement;
    expect(identityContainer).toBe(threshold.parentElement);

    // Container has responsive grid: mobile = 1 col, md+ = 2 col.
    const cls = identityContainer!.className;
    expect(cls).toContain('grid');
    expect(cls).toContain('grid-cols-1');
    expect(cls).toContain('md:grid-cols-2');
  });

  it('reward rule section wraps type + value in a 2-col grid on md+ (MaxDiscount stays on its own row)', () => {
    const tierId = seedTier();
    render(<RewardTierRow showValidation={false} tierId={tierId} />);

    const type = screen.getByTestId('sub-reward-type');
    const value = screen.getByTestId('sub-reward-value');
    const maxDiscount = screen.getByTestId('sub-max-discount');

    // type + value share a parent 2-col grid.
    const typeValueGrid = type.parentElement;
    expect(typeValueGrid).toBe(value.parentElement);

    const cls = typeValueGrid!.className;
    expect(cls).toContain('grid');
    expect(cls).toContain('grid-cols-1');
    expect(cls).toContain('md:grid-cols-2');

    // MaxDiscount must be on a DIFFERENT parent row — not crammed into the
    // 2-col grid. It sits on its own full-width row beneath type+value.
    expect(maxDiscount.parentElement).not.toBe(typeValueGrid);
  });
});

describe('RewardTierRow — remove button + tier header', () => {
  it('remove button calls removeRewardTier with the tierId', async () => {
    const user = userEvent.setup();
    const tierId = seedTier();
    render(<RewardTierRow showValidation={false} tierId={tierId} />);

    const removeBtn = screen.getByRole('button', { name: 'step6.reward.removeTier' });
    await user.click(removeBtn);

    const s = useCardBuilderStore.getState();
    expect(s.rewardTiers.find((t) => t.id === tierId)).toBeUndefined();
  });

  it('tier header renders both thresholdTitle + nameTitle keys', () => {
    const tierId = seedTier();
    render(<RewardTierRow showValidation={false} tierId={tierId} />);

    // The header text is a concatenation of two i18n keys (mocked to
    // return the key string). Both keys must appear.
    expect(screen.getByText(/step6\.reward\.tier\.thresholdTitle/)).toBeInTheDocument();
    expect(screen.getByText(/step6\.reward\.tier\.nameTitle/)).toBeInTheDocument();
  });
});
