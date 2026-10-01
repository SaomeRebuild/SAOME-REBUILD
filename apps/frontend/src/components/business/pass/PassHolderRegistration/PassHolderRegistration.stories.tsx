import type { Meta, StoryObj } from '@storybook/react';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderRegistration } from './PassHolderRegistration';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

const meta = {
  title: 'Business/Pass/PassHolderRegistration',
  component: PassHolderRegistration,
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
} satisfies Meta<typeof PassHolderRegistration>;

export default meta;
type Story = StoryObj<typeof meta>;

const rewardTemplate: PublicPassTemplate = {
  id: 'demo-cafe',
  name: 'Café Rewards',
  cardType: 'reward_card',
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
};

const membershipTemplate: PublicPassTemplate = {
  id: 'demo-gym',
  name: 'FitClub Membership',
  cardType: 'membership_card',
  logoText: 'FitClub',
  issuerName: 'FitClub Taiwan',
};

const giftTemplate: PublicPassTemplate = {
  id: 'demo-gift',
  name: 'Gift Card Studio',
  cardType: 'gift_card',
  logoText: 'Gift Studio',
  issuerName: 'Gift Card Studio',
};

export const RewardCard: Story = {
  args: { template: rewardTemplate, onSubmit: () => {} },
};

export const MembershipCard: Story = {
  args: { template: membershipTemplate, onSubmit: () => {} },
};

export const GiftCard: Story = {
  args: { template: giftTemplate, onSubmit: () => {} },
};

export const Submitting: Story = {
  args: { template: rewardTemplate, onSubmit: () => {}, isSubmitting: true },
};