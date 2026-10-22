/**
 * PassHolderGiftCard stories — the states a merchant or reviewer needs
 * to see during design review:
 *
 *   1. TWD / 綠界, idle, nothing entered (CTA gated)
 *   2. TWD / 綠界 with a valid points value (CTA shows the derived price)
 *   3. ZAR / Payfast with a valid points value
 *   4. TWD with an out-of-range value (inline fence message + gated CTA)
 *   5. TWD, payment in flight
 *   6. TWD, paid
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderGiftCard } from './PassHolderGiftCard';
import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';

const CONFIG: PublicGiftCardConfig = {
  unitAmount: 100,
  unitPoints: 10,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

const meta = {
  title: 'Business/Pass/PassHolderGiftCard',
  component: PassHolderGiftCard,
  argTypes: {
    currency: { control: 'inline-radio', options: ['TWD', 'ZAR'] },
    paymentState: { control: 'inline-radio', options: ['idle', 'paying', 'paid'] },
  },
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
} satisfies Meta<typeof PassHolderGiftCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Stateful wrapper — the points input is controlled, so a static story
 * would snap back to empty on every keystroke.
 */
function Harness(args: React.ComponentProps<typeof PassHolderGiftCard>) {
  const [points, setPoints] = useState<number | null>(null);
  return (
    <PassHolderGiftCard
      {...args}
      purchasedPoints={points}
      onPurchasedPointsChange={setPoints}
    />
  );
}

export const Default: Story = {
  args: {
    config: CONFIG,
    currency: 'TWD',
    purchasedPoints: null,
    paymentState: 'idle',
    onPurchasedPointsChange: () => {},
    onSimulatePayment: () => {},
  },
  render: (args) => <Harness {...args} />,
};

/** 500 點 → NT$ 5,000. CTA carries the price. */
export const WithPoints: Story = {
  args: {
    ...Default.args,
    purchasedPoints: 500,
  },
};

/** South Africa: R 5,000 through Payfast. */
export const ZarPayfast: Story = {
  args: {
    ...Default.args,
    currency: 'ZAR',
    purchasedPoints: 500,
  },
};

/** 50 點 is below checkoutMinPoints → inline fence message, CTA gated. */
export const BelowMinimum: Story = {
  args: {
    ...Default.args,
    purchasedPoints: 50,
  },
};

/** 505 點 is not a whole multiple of the rate → unpriceable, CTA gated. */
export const NotWholeMultiple: Story = {
  args: {
    ...Default.args,
    purchasedPoints: 505,
  },
};

export const Paying: Story = {
  args: {
    ...Default.args,
    purchasedPoints: 500,
    paymentState: 'paying',
  },
};

export const Paid: Story = {
  args: {
    ...Default.args,
    purchasedPoints: 500,
    paymentState: 'paid',
  },
};