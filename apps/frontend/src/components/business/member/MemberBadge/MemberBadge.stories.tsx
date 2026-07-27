import type { Meta, StoryObj } from '@storybook/react';
import { MemberBadge } from './MemberBadge';

const meta = {
  title: 'Business/Member/MemberBadge',
  component: MemberBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    tier: {
      control: 'select',
      options: ['bronze', 'silver', 'gold'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof MemberBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gold: Story = {
  args: {
    tier: 'gold',
  },
};

export const Silver: Story = {
  args: {
    tier: 'silver',
  },
};

export const Bronze: Story = {
  args: {
    tier: 'bronze',
  },
};

export const Small: Story = {
  args: {
    tier: 'gold',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    tier: 'gold',
    size: 'lg',
  },
};

export const AllTiers: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <MemberBadge tier="bronze" />
      <MemberBadge tier="silver" />
      <MemberBadge tier="gold" />
    </div>
  ),
};
