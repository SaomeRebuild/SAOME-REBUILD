/**
 * Storybook stories for Step3StampGrid.
 *
 * Stories are wrapped in a small wrapper that mounts a real
 * `useCardBuilderStore` so the radios / icon picker are interactive.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Step3StampGrid } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

function StoryWrapper({ defaultRows = 1, defaultIcon = '' }: { defaultRows?: 1 | 2 | 3 | 4; defaultIcon?: string }) {
  // Seed store on every render — Storybook re-mounts per story.
  useCardBuilderStore.setState({ stampGridRows: defaultRows, stampIconId: defaultIcon });
  return (
    <div className="max-w-xl p-4">
      <Step3StampGrid />
    </div>
  );
}

const meta: Meta<typeof Step3StampGrid> = {
  title: 'business/dashboard/CardBuilderEditor/Step3StampGrid',
  component: Step3StampGrid,
};

export default meta;
type Story = StoryObj<typeof Step3StampGrid>;

export const Default: Story = {
  render: () => <StoryWrapper />,
};

export const WithBellIcon: Story = {
  render: () => <StoryWrapper defaultIcon="bell" />,
};

export const Rows4: Story = {
  render: () => <StoryWrapper defaultRows={4} />,
};

export const Rows4Fire: Story = {
  render: () => <StoryWrapper defaultRows={4} defaultIcon="fire" />,
};
