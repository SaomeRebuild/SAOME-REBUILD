/**
 * RewardCardLogic — Storybook Stories (Rule 025 § 3)
 *
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level, set
 * via `<EarningModeField />`). Per-tier fields carry only the earn rate
 * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints) — each
 * tier can configure its own rate under the same card-wide mode.
 *
 * Stories cover the REWARD card sub-module's main combinations:
 *   - card-wide earningMode × per-tier rewardType × cap × currency
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Storybook.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { RewardCardLogic } from './RewardCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

const meta = {
  title: 'Business/CardBuilderEditor/RewardCardLogic',
  component: RewardCardLogic,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'card' },
  },
  decorators: [
    (Story) => {
      useCardBuilderStore.getState().reset();
      useCardBuilderStore.setState({ cardType: 'reward_card' });
      return <Story />;
    },
  ],
} satisfies Meta<typeof RewardCardLogic>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Empty / Validation =====

export const Empty: Story = {
  render: () => <RewardCardLogic showValidation={false} />,
};

export const WithValidationErrors: Story = {
  render: () => {
    // tier 為空 → 顯示紅框
    return <RewardCardLogic showValidation={true} />;
  },
};

// ===== Earning Mode × Reward Type =====

export const BasedOnPointsAmount: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_points',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500點折抵50元',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
        {
          id: 'tier-2',
          name: '1000點折抵10%',
          threshold: 1000,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 100,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

export const BasedOnVisits: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '100點折抵10元',
          threshold: 100,
          rewardType: 'amount_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: 10,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

export const BasedOnSpending: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_spending',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500點折抵5%',
          threshold: 500,
          rewardType: 'percent_off',
          rewardValue: 5,
          maxDiscountAmount: 50,
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

// ===== Currency variants =====

export const ZARCurrency: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'ZAR',
      earningMode: 'based_on_spending',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500 pts for R50 off',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

export const TWDCurrency: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'TWD',
      earningMode: 'based_on_spending',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500點折抵50元',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: null,
          pointsPerSpendAmount: 100,
          pointsPerSpendPoints: 1,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

// ===== Edge cases =====

export const PercentWithCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '8% 折扣，最高 100 元',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 8,
          maxDiscountAmount: 100,
          pointsPerVisit: 5,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

export const PercentNoCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '10% 折扣，無上限',
          threshold: 200,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: null,
          pointsPerVisit: 5,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

export const MaxTiersReached: Story = {
  render: () => {
    // 2026-09-09 mixed refactor: card-wide mode = based_on_visits,
    // each tier can have its own pointsPerVisit.
    const tiers = Array.from({ length: 5 }, (_, i) => ({
      id: `tier-${i + 1}`,
      name: `${(i + 1) * 500}點折抵${(i + 1) * 10}元`,
      threshold: (i + 1) * 500,
      rewardType: 'amount_off' as const,
      rewardValue: (i + 1) * 10,
      maxDiscountAmount: null,
      pointsPerVisit: (i + 1) * 5,
      pointsPerSpendAmount: null,
      pointsPerSpendPoints: null,
    }));
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: tiers,
    });
    return <RewardCardLogic showValidation={false} />;
  },
};

/**
 * Per-tier independent rate story — same card-wide mode, different per-tier rates.
 */
export const PerTierIndependentRate: Story = {
  render: () => {
    useCardBuilderStore.setState({
      earningMode: 'based_on_visits',
      rewardTiers: [
        {
          id: 'tier-1',
          name: '500點 (每次拜訪 5 點)',
          threshold: 500,
          rewardType: 'amount_off',
          rewardValue: 50,
          maxDiscountAmount: null,
          pointsPerVisit: 5,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
        {
          id: 'tier-2',
          name: '1000點 (每次拜訪 10 點)',
          threshold: 1000,
          rewardType: 'percent_off',
          rewardValue: 10,
          maxDiscountAmount: 100,
          pointsPerVisit: 10, // tier-2: 1 visit = 10 points (different from tier-1)
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
        {
          id: 'tier-3',
          name: '2000點 (每次拜訪 20 點)',
          threshold: 2000,
          rewardType: 'percent_off',
          rewardValue: 15,
          maxDiscountAmount: null,
          pointsPerVisit: 20, // tier-3: 1 visit = 20 points
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        },
      ],
    });
    return <RewardCardLogic showValidation={false} />;
  },
};
