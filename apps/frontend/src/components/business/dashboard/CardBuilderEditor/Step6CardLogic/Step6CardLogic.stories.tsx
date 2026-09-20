/**
 * Step6CardLogic — Storybook Stories (Rule 025 § 3)
 *
 * Stories:
 *   - Default: stamp_card with default state
 *   - SelectedModes: stamp_card with all 4 fields set
 *   - PercentModeWithCap: shows max discount field
 *   - ComingSoon: cashback_card (placeholder)
 *   - NoCardType: cardType is null (placeholder)
 *   - Multipass: multipass with default 1-row tier (PR-3 split out 2026-09-19)
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.3.
 * Plan ref: step6_multipass_模組化實作 plan 2026-09-19 § Phase 6.3 stories.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Step6CardLogic } from './Step6CardLogic';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

const meta = {
  title: 'Business/CardBuilderEditor/Step6CardLogic',
  component: Step6CardLogic,
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'card',
    },
  },
  decorators: [
    (Story) => {
      // Reset store before each story render
      useCardBuilderStore.getState().reset();
      return <Story />;
    },
  ],
} satisfies Meta<typeof Step6CardLogic>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const SelectedModes: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_visit',
      rewardName: '8% 折扣',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
    });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const AmountModeWithCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null, // amount_off doesn't use cap but still keep
    });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const PercentModeNoCap: Story = {
  render: () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampAccrualMode: 'per_spend',
      rewardName: '免費兌換',
      rewardType: 'percent_off',
      rewardValue: 100,
      maxDiscountAmount: 0, // 0 = no cap
    });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const ValidationErrors: Story = {
  render: () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    return <Step6CardLogic showValidation={true} />;
  },
};

export const ComingSoon: Story = {
  render: () => {
    useCardBuilderStore.setState({ cardType: 'cashback_card' });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const NoCardType: Story = {
  render: () => {
    useCardBuilderStore.setState({ cardType: null });
    return <Step6CardLogic showValidation={false} />;
  },
};

export const Multipass: Story = {
  render: () => {
    // 2026-09-19 PR-3: multipass now uses its own dedicated sub-module
    // (MultipassCardLogic). The dispatcher routes multipass_card to
    // MultipassCardLogic instead of sharing the stamp_card editor.
    useCardBuilderStore.setState({
      cardType: 'multipass',
      multipassTiers: [
        { id: 't-0', name: '新戶禮', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 10 },
        { id: 't-1', name: '滿 5 次回訪', stampsNeeded: 5, rewardType: 'percent_off', rewardValue: 5 },
      ],
    });
    return <Step6CardLogic showValidation={false} />;
  },
};
