/**
 * PassHolderMembershipTiers stories — 3 visual states for design
 * review: TWD/Ecpay idle, ZAR/Payfast idle, and TWD paid.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderMembershipTiers } from './PassHolderMembershipTiers';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

const meta = {
  title: 'Business/Pass/PassHolderMembershipTiers',
  component: PassHolderMembershipTiers,
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
} satisfies Meta<typeof PassHolderMembershipTiers>;

export default meta;
type Story = StoryObj<typeof meta>;

const twdTemplate: PublicPassTemplate = {
  id: 'demo-gym',
  name: 'FitClub Membership',
  cardType: 'membership_card',
  logoText: 'FitClub',
  issuerName: 'FitClub Taiwan',
  language: 'zh-TW',
  currency: 'TWD',
  isPaid: true,
  membershipTiers: [
    {
      name: 'Basic',
      rewards: [{ label: '95 折飲料', value: 'https://example.com/basic' }],
      monthlyCost: 100,
      yearlyCost: null,
      durationType: 'monthly',
    },
    {
      name: 'VIP',
      rewards: [
        { label: '免費蔬果汁', value: 'https://example.com/vip' },
        { label: '優先預約', value: 'https://example.com/booking' },
      ],
      monthlyCost: 200,
      yearlyCost: null,
      durationType: 'monthly',
    },
  ],
};

const zarTemplate: PublicPassTemplate = {
  ...twdTemplate,
  id: 'demo-gym-zar',
  name: 'FitClub ZA',
  currency: 'ZAR',
  membershipTiers: [
    {
      name: 'Basic',
      rewards: [{ label: '10% off drinks', value: 'https://example.com/basic' }],
      monthlyCost: 500,
      yearlyCost: null,
      durationType: 'monthly',
    },
    {
      name: 'VIP',
      rewards: [
        { label: 'Free smoothie', value: 'https://example.com/vip' },
        { label: 'Priority booking', value: 'https://example.com/booking' },
      ],
      monthlyCost: 1000,
      yearlyCost: null,
      durationType: 'monthly',
    },
  ],
};

export const TWD_Ecpay: Story = {
  args: {
    template: twdTemplate,
    selectedTierIndex: null,
    onSelectTier: () => {},
    paymentState: 'idle',
    onSimulatePayment: () => {},
  },
};

export const ZAR_Payfast: Story = {
  args: {
    template: zarTemplate,
    selectedTierIndex: 1,
    onSelectTier: () => {},
    paymentState: 'idle',
    onSimulatePayment: () => {},
  },
};

export const PaidState: Story = {
  args: {
    template: twdTemplate,
    selectedTierIndex: 1,
    onSelectTier: () => {},
    paymentState: 'paid',
    onSimulatePayment: () => {},
  },
};
