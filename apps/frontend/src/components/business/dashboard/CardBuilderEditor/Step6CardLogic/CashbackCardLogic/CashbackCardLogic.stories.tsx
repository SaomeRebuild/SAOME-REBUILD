/**
 * CashbackCardLogic — Storybook Stories (Rule 025 § 3)
 *
 * Stories cover the Cashback card sub-module's main combinations:
 *   - Empty state (no tiers yet)
 *   - Single default tier (threshold = 0)
 *   - Multiple tiers (sorted ASC by thresholdSpend)
 *   - Currency variants: TWD zh-TW / TWD en / ZAR
 *   - Max-tier-cap (5 tiers)
 *   - Validation errors (showValidation=true + empty tier name)
 *
 * Plan ref: Step 6 CashbackCardLogic 2026-09-11 § Phase 8 Storybook.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { CashbackCardLogic } from './CashbackCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { Currency } from '@saome/shared/schemas/card';

const meta = {
  title: 'Business/CardBuilderEditor/CashbackCardLogic',
  component: CashbackCardLogic,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'card' },
  },
  decorators: [
    (Story) => {
      useCardBuilderStore.getState().reset();
      useCardBuilderStore.setState({ cardType: 'cashback_card' });
      return <Story />;
    },
  ],
} satisfies Meta<typeof CashbackCardLogic>;

export default meta;
type Story = StoryObj<typeof meta>;

// ===== Empty / Validation =====

export const Empty: Story = {
  render: () => <CashbackCardLogic showValidation={false} />,
};

export const WithValidationErrors: Story = {
  render: () => {
    // 1 tier with empty name → 顯示紅框 + 必填錯誤
    useCardBuilderStore.setState({
      cashbackTiers: [
        { id: 't-1', name: '', thresholdSpend: 1000, cashbackPercent: 5 },
      ],
    });
    return <CashbackCardLogic showValidation={true} />;
  },
};

// ===== Default tier (threshold = 0) =====

export const DefaultTierOnly: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, cashbackPercent: 1 },
      ],
    });
    return <CashbackCardLogic showValidation={false} />;
  },
};

// ===== Multi-tier (TWD zh-TW) =====

export const MultiTierTwdZh: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'TWD' as Currency,
      cashbackTiers: [
        { id: 't-1', name: '一般會員', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 't-2', name: '銀卡', thresholdSpend: 1000, cashbackPercent: 3 },
        { id: 't-3', name: '金卡', thresholdSpend: 5000, cashbackPercent: 5 },
        { id: 't-4', name: 'VIP', thresholdSpend: 10000, cashbackPercent: 10 },
      ],
    });
    return <CashbackCardLogic showValidation={false} />;
  },
};

// ===== Multi-tier (TWD en, NT$ prefix) =====

export const MultiTierTwdEn: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'TWD' as Currency,
      cashbackTiers: [
        { id: 't-1', name: 'Standard', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 't-2', name: 'Gold', thresholdSpend: 5000, cashbackPercent: 5 },
      ],
    });
    return <CashbackCardLogic showValidation={false} />;
  },
};

// ===== Multi-tier (ZAR, R prefix) =====

export const MultiTierZar: Story = {
  render: () => {
    useCardBuilderStore.setState({
      currency: 'ZAR' as Currency,
      cashbackTiers: [
        { id: 't-1', name: 'Standard', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 't-2', name: 'Gold', thresholdSpend: 500, cashbackPercent: 5 },
      ],
    });
    return <CashbackCardLogic showValidation={false} />;
  },
};

// ===== Max cap (5 tiers) =====

export const MaxTiersCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cashbackTiers: [
        { id: 't-1', name: 'Tier 1', thresholdSpend: 0, cashbackPercent: 1 },
        { id: 't-2', name: 'Tier 2', thresholdSpend: 500, cashbackPercent: 2 },
        { id: 't-3', name: 'Tier 3', thresholdSpend: 1000, cashbackPercent: 3 },
        { id: 't-4', name: 'Tier 4', thresholdSpend: 5000, cashbackPercent: 5 },
        { id: 't-5', name: 'Tier 5', thresholdSpend: 10000, cashbackPercent: 10 },
      ],
    });
    return <CashbackCardLogic showValidation={false} />;
  },
};
