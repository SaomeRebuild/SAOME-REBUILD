/**
 * StampCardLogic — Storybook Stories (Rule 025 § 3)
 *
 * Stories cover all combinations of mode × type × cap for the stamp card
 * sub-module. Each story sets the store state directly so the editor
 * renders the same shape it would in production.
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.3.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { StampCardLogic } from './StampCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

const meta = {
  title: 'Business/CardBuilderEditor/StampCardLogic',
  component: StampCardLogic,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'card' },
  },
  decorators: [
    (Story) => {
      useCardBuilderStore.getState().reset();
      return <Story />;
    },
  ],
} satisfies Meta<typeof StampCardLogic>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Default & Empty =====

export const Empty: Story = {
  render: () => <StampCardLogic showValidation={false} />,
};

export const WithValidationErrors: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: null,
      rewardName: '',
      rewardType: null,
      rewardValue: null,
    });
    return <StampCardLogic showValidation={true} />;
  },
};

// ===== Accrual Modes × Reward Types =====

export const PerStampAmount: Story = {
  render: () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
    });
    return <StampCardLogic showValidation={false} />;
  },
};

export const PerVisitPercentNoCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '8% 折扣',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: null,
    });
    return <StampCardLogic showValidation={false} />;
  },
};

export const PerSpendPercentWithCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_spend',
      rewardName: '5% 折扣，最高 50 元',
      rewardType: 'percent_off',
      rewardValue: 5,
      maxDiscountAmount: 50,
    });
    return <StampCardLogic showValidation={false} />;
  },
};

export const PerVisitZeroIsNoCap: Story = {
  render: () => {
    // maxDiscountAmount=0 should show "輸入 0 = 無上限" helper
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '10% 折扣',
      rewardType: 'percent_off',
      rewardValue: 10,
      maxDiscountAmount: 0,
    });
    return <StampCardLogic showValidation={false} />;
  },
};

// ===== RewardName variations =====

export const LongRewardName: Story = {
  render: () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: '集滿 10 個印章兌換 10 元折價活動（限下次消費使用）',
      rewardType: 'amount_off',
      rewardValue: 10,
    });
    return <StampCardLogic showValidation={false} />;
  },
};

export const EnglishRewardName: Story = {
  render: () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '$10 store credit',
      rewardType: 'amount_off',
      rewardValue: 10,
    });
    return <StampCardLogic showValidation={false} />;
  },
};
