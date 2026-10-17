/**
 * PassHolderPaymentButton stories — 6 visual states (Payfast × idle /
 * paying / paid, Ecpay × idle / paying / paid).
 */

import type { Meta, StoryObj } from '@storybook/react';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderPaymentButton } from './PassHolderPaymentButton';

const meta = {
  title: 'Business/Pass/PassHolderPaymentButton',
  component: PassHolderPaymentButton,
  decorators: [
    (Story) => (
      <I18nextProvider i18n={testI18n}>
        <div className="mx-auto max-w-screen-sm p-4">
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PassHolderPaymentButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseLabels = {
  idleLabel: '以綠界付款',
  paying: '付款處理中…',
  paid: '已付款',
};

// 2026-10-16 — alternate idle labels that the parent resolves based on
// the selected tier. These stories document the user-facing CTA contract
// (Rule 023 § component-bound i18n: button only knows the rendered string).
const amountLabels = {
  idleLabel: 'Pay NT$ 100 & Get Pass',
  paying: '付款處理中…',
  paid: '已付款',
};

const freeTierLabels = {
  idleLabel: 'Get Free Pass',
  paying: '付款處理中…',
  paid: '已付款',
};

export const Payfast_Idle: Story = {
  args: {
    provider: 'payfast',
    paymentState: 'idle',
    labels: baseLabels,
    onClick: () => {},
  },
};

export const Payfast_Paying: Story = {
  args: {
    provider: 'payfast',
    paymentState: 'paying',
    labels: baseLabels,
    onClick: () => {},
  },
};

export const Payfast_Paid: Story = {
  args: {
    provider: 'payfast',
    paymentState: 'paid',
    labels: baseLabels,
    onClick: () => {},
  },
};

export const Ecpay_Idle: Story = {
  args: {
    provider: 'ecpay',
    paymentState: 'idle',
    labels: baseLabels,
    onClick: () => {},
  },
};

export const Ecpay_Paying: Story = {
  args: {
    provider: 'ecpay',
    paymentState: 'paying',
    labels: baseLabels,
    onClick: () => {},
  },
};

export const Ecpay_Paid: Story = {
  args: {
    provider: 'ecpay',
    paymentState: 'paid',
    labels: baseLabels,
    onClick: () => {},
  },
};

// 2026-10-16 — CTA shows amount + action when a paid tier is selected.
// Documents the parent → button data flow: parent resolves the idle
// string ("Pay NT$ 100 & Get Pass"), button is purely presentational.
export const Ecpay_Idle_WithAmount: Story = {
  args: {
    provider: 'ecpay',
    paymentState: 'idle',
    labels: amountLabels,
    onClick: () => {},
  },
};

// 2026-10-16 — CTA shows the free-tier variant when a paid template
// has a free tier (cost === null). The button is still active; the
// parent decides what label to render.
export const Ecpay_Idle_FreeTier: Story = {
  args: {
    provider: 'ecpay',
    paymentState: 'idle',
    labels: freeTierLabels,
    onClick: () => {},
  },
};
