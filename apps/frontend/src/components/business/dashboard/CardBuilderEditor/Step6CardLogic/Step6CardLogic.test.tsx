/**
 * Step6CardLogic — Vitest + RTL Tests (Rule 003 TDD + Rule 000 L2 結構)
 *
 * Verifies the dispatcher routes to the right sub-module based on cardType:
 *   - null          → ComingSoon
 *   - stamp_card    → StampCardLogic (集點卡)
 *   - multipass     → StampCardLogic (集點卡 shared)
 *   - reward_card   → RewardCardLogic (獎勵卡, 2026-09-09)
 *   - cashback_card → ComingSoon (Step 6 not yet implemented for non-stamp types)
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 dispatcher test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Step6CardLogic } from './Step6CardLogic';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { CardType } from '@saome/shared/schemas/card';

// Mock i18n so we get predictable t(key) → key output for assertions.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

// Track which sub-component is rendered.
let stampCardLogicRenders = 0;
let rewardCardLogicRenders = 0;
let comingSoonRenders = 0;

vi.mock('./StampCardLogic', () => ({
  StampCardLogic: () => {
    stampCardLogicRenders += 1;
    return <div data-testid="stamp-card-logic">StampCardLogic</div>;
  },
}));

vi.mock('./RewardCardLogic', () => ({
  RewardCardLogic: () => {
    rewardCardLogicRenders += 1;
    return <div data-testid="reward-card-logic">RewardCardLogic</div>;
  },
}));

vi.mock('./Step6CardLogicComingSoon', () => ({
  Step6CardLogicComingSoon: ({ cardType }: { cardType: CardType | null }) => {
    comingSoonRenders += 1;
    return (
      <div data-testid="coming-soon" data-card-type={cardType ?? 'null'}>
        ComingSoon
      </div>
    );
  },
}));

beforeEach(() => {
  stampCardLogicRenders = 0;
  rewardCardLogicRenders = 0;
  comingSoonRenders = 0;
});

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('Step6CardLogic — dispatcher (Rule 000 § A.1)', () => {
  it('renders ComingSoon when cardType is null', () => {
    useCardBuilderStore.setState({ cardType: null });
    render(<Step6CardLogic showValidation={false} />);

    expect(stampCardLogicRenders).toBe(0);
    expect(rewardCardLogicRenders).toBe(0);
    expect(comingSoonRenders).toBe(1);
    expect(screen.getByTestId('coming-soon')).toHaveAttribute(
      'data-card-type',
      'null',
    );
  });

  it('renders StampCardLogic for stamp_card', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(<Step6CardLogic showValidation={false} />);

    expect(stampCardLogicRenders).toBe(1);
    expect(rewardCardLogicRenders).toBe(0);
    expect(comingSoonRenders).toBe(0);
    expect(screen.getByTestId('stamp-card-logic')).toBeInTheDocument();
  });

  it('renders StampCardLogic for multipass (shared logic with stamp_card)', () => {
    useCardBuilderStore.setState({ cardType: 'multipass' });
    render(<Step6CardLogic showValidation={false} />);

    expect(stampCardLogicRenders).toBe(1);
    expect(rewardCardLogicRenders).toBe(0);
    expect(comingSoonRenders).toBe(0);
    expect(screen.getByTestId('stamp-card-logic')).toBeInTheDocument();
  });

  it('renders RewardCardLogic for reward_card (Step 6 plan 2026-09-09)', () => {
    useCardBuilderStore.setState({ cardType: 'reward_card' });
    render(<Step6CardLogic showValidation={false} />);

    expect(stampCardLogicRenders).toBe(0);
    expect(rewardCardLogicRenders).toBe(1);
    expect(comingSoonRenders).toBe(0);
    expect(screen.getByTestId('reward-card-logic')).toBeInTheDocument();
  });

  it('renders ComingSoon for cashback_card (not yet supported)', () => {
    useCardBuilderStore.setState({ cardType: 'cashback_card' });
    render(<Step6CardLogic showValidation={false} />);

    expect(stampCardLogicRenders).toBe(0);
    expect(rewardCardLogicRenders).toBe(0);
    expect(comingSoonRenders).toBe(1);
    expect(screen.getByTestId('coming-soon')).toHaveAttribute(
      'data-card-type',
      'cashback_card',
    );
  });

  it('renders ComingSoon for membership_card (not yet supported)', () => {
    useCardBuilderStore.setState({ cardType: 'membership_card' });
    render(<Step6CardLogic showValidation={false} />);

    expect(comingSoonRenders).toBe(1);
    expect(screen.getByTestId('coming-soon')).toHaveAttribute(
      'data-card-type',
      'membership_card',
    );
  });

  it('renders ComingSoon for discount_card, coupon_card, gift_card', () => {
    const unsupportedTypes: CardType[] = [
      'discount_card',
      'coupon_card',
      'gift_card',
    ];

    for (const cardType of unsupportedTypes) {
      // Reset sub-component counters for each iteration.
      stampCardLogicRenders = 0;
      rewardCardLogicRenders = 0;
      comingSoonRenders = 0;
      cleanup();
      useCardBuilderStore.setState({ cardType });
      const { unmount } = render(<Step6CardLogic showValidation={false} />);

      expect(stampCardLogicRenders).toBe(0);
      expect(rewardCardLogicRenders).toBe(0);
      expect(comingSoonRenders).toBe(1);
      expect(screen.getByTestId('coming-soon')).toHaveAttribute(
        'data-card-type',
        cardType,
      );

      unmount();
    }
  });

  it('renders the Step 6 intro hero text inside the dispatcher (when supported)', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(<Step6CardLogic showValidation={false} />);

    // Dispatcher hero text uses t('step6.intro') and t('step6.introHint').
    expect(screen.getByText('step6.intro')).toBeInTheDocument();
    expect(screen.getByText('step6.introHint')).toBeInTheDocument();
  });

  it('renders the Step 6 reward-card-specific intro hero text for reward_card', () => {
    useCardBuilderStore.setState({ cardType: 'reward_card' });
    render(<Step6CardLogic showValidation={false} />);

    // Dispatcher uses t('step6.reward.intro') and t('step6.reward.introHint')
    // for reward_card branch (distinct copy from stamp_card branch).
    expect(screen.getByText('step6.reward.intro')).toBeInTheDocument();
    expect(screen.getByText('step6.reward.introHint')).toBeInTheDocument();
  });
});
