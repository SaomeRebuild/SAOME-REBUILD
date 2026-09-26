/**
 * GiftCardLogic — Storybook stories (Rule 025 § 1 E.7)
 *
 * 4 stories:
 *   - Default: TWD, 1:1 (initial state)
 *   - ZAR: ZAR currency, 100:100 rate
 *   - ValidationError: showValidation=true + invalid state (red borders)
 *   - LargeRate: 1000元 = 10000點 (high values, demonstrates layout)
 *
 * Usage: `npm run storybook` → navigate to "CardBuilderEditor/Step6CardLogic/GiftCardLogic"
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { GiftCardLogic } from './GiftCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

const meta: Meta<typeof GiftCardLogic> = {
  title: 'CardBuilderEditor/Step6CardLogic/GiftCardLogic',
  component: GiftCardLogic,
  decorators: [
    (Story, ctx) => {
      // Sync Story args to the Zustand store before rendering.
      // Mirrors how the real CardBuilderEditor pipeline seeds state.
      const initialState = (ctx.args as { initialState?: Record<string, unknown> })
        .initialState;
      useEffect(() => {
        if (initialState) {
          useCardBuilderStore.setState(initialState as never);
        }
        return () => useCardBuilderStore.getState().reset();
      }, [initialState]);
      return <Story />;
    },
  ],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof GiftCardLogic>;

export const Default: Story = {
  args: {
    showValidation: false,
    initialState: {
      cardType: 'gift_card',
      currency: 'TWD',
      giftCardAmount: 1,
      giftCardPoints: 1,
    },
  },
};

export const ZAR: Story = {
  args: {
    showValidation: false,
    initialState: {
      cardType: 'gift_card',
      currency: 'ZAR',
      giftCardAmount: 100,
      giftCardPoints: 100,
    },
  },
};

export const ValidationError: Story = {
  args: {
    showValidation: true,
    initialState: {
      cardType: 'gift_card',
      currency: 'TWD',
      // Simulate a corrupted DB row with amount=0 — showValidation=true
      // surfaces the red border + error message.
      giftCardAmount: 0,
      giftCardPoints: 0,
    },
  },
};

export const LargeRate: Story = {
  args: {
    showValidation: false,
    initialState: {
      cardType: 'gift_card',
      currency: 'TWD',
      giftCardAmount: 1000,
      giftCardPoints: 10000,
    },
  },
};