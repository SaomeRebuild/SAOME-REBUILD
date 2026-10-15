/**
 * StampCardImageComposer — Storybook story (Phase 2, 2026-10-13).
 *
 * Stories are auto-registered by Storybook's
 * `../.storybook/main.ts` glob (excluded from tsconfig.app.json to keep
 * the build fast). They are documentation for designers and a quick
 * visual smoke test before code review.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { StampCardImageComposer } from './StampCardImageComposer';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';

const meta: Meta<typeof StampCardImageComposer> = {
  title: 'business/stampCard/StampCardImageComposer',
  component: StampCardImageComposer,
  parameters: { layout: 'centered' },
};

export default meta;

type Story = StoryObj<typeof StampCardImageComposer>;

const baseInput: StampCardImageInput = {
  rows: 3,
  cols: 5,
  gridColor: 'transparent',
  iconId: 'bell',
  iconColor: '#FF0000',
  background: { type: 'color', value: '#FFFFFF' },
  fillCount: 0,
};

export const Idle: Story = {
  args: {
    templateId: 'tpl-1',
    authToken: 'tkn',
    input: baseInput,
  },
};

export const NoTemplate: Story = {
  args: {
    templateId: null,
    authToken: 'tkn',
    input: baseInput,
  },
};

export const LargeGrid: Story = {
  args: {
    templateId: 'tpl-1',
    authToken: 'tkn',
    input: { ...baseInput, rows: 4, cols: 5 },
  },
};

export const ColorBackground: Story = {
  args: {
    templateId: 'tpl-1',
    authToken: 'tkn',
    input: { ...baseInput, background: { type: 'color', value: '#1f2937' } },
  },
};

export const ImageBackground: Story = {
  args: {
    templateId: 'tpl-1',
    authToken: 'tkn',
    input: {
      ...baseInput,
      background: { type: 'image', url: 'https://r2.example.com/bg.png' },
    },
  },
};
