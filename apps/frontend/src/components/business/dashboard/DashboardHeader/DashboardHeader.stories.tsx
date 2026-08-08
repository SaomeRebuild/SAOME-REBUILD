import type { Meta, StoryObj } from '@storybook/react';
import { DashboardHeader } from './DashboardHeader';

const meta: Meta<typeof DashboardHeader> = {
  title: 'business/dashboard/DashboardHeader',
  component: DashboardHeader,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof DashboardHeader>;

export const Default: Story = {
  args: {
    navItems: [
      { key: 'Dashboard', href: '/app/dashboard' },
      { key: 'Members', href: '/app/members' },
    ],
  },
};

export const EmptyNav: Story = {
  args: {
    navItems: [],
  },
};
