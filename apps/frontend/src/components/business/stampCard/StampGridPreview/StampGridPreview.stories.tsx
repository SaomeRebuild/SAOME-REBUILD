/**
 * Storybook stories for StampGridPreview.
 *
 * Each story exercises a different (rows, stripHeight) combination so the
 * cell-size formula's effect is visible at a glance. `iconOverride` is used
 * so the stories don't depend on real PNG asset URLs (Storybook renders this
 * in isolation, and the manifest's `import.meta.glob` may not be wired up in
 * Storybook's bundling pipeline the same way as in the app).
 */

import type { Meta, StoryObj } from '@storybook/react';
import { StampGridPreview } from './StampGridPreview';

const ICON_OVERRIDE = {
  stampedUrl: 'https://placehold.co/100/1f2937/ffffff?text=ON',
  unstampedUrl: 'https://placehold.co/100/d1d5db/6b7280?text=off',
};

const meta: Meta<typeof StampGridPreview> = {
  title: 'business/stampCard/StampGridPreview',
  component: StampGridPreview,
  args: {
    iconId: 'bell',
    iconOverride: ICON_OVERRIDE,
  },
  argTypes: {
    rows: { control: 'inline-radio', options: [1, 2, 3, 4] },
    cols: { control: { type: 'number', min: 1, max: 5 } },
    stampedCount: { control: { type: 'number', min: 0, max: 20 } },
    stripHeight: { control: { type: 'number', min: 80, max: 200 } },
    stripWidth: { control: { type: 'number', min: 200, max: 400 } },
  },
};

export default meta;
type Story = StoryObj<typeof StampGridPreview>;

export const Rows1Normal: Story = {
  args: { rows: 1, stripHeight: 120 },
};

export const Rows2Normal: Story = {
  args: { rows: 2, stripHeight: 120 },
};

export const Rows3Normal: Story = {
  args: { rows: 3, stripHeight: 120 },
};

export const Rows4Normal: Story = {
  args: { rows: 4, stripHeight: 120 },
};

export const Rows4Compact: Story = {
  args: { rows: 4, stripHeight: 100 },
};

export const Rows2HalfStamped: Story = {
  args: { rows: 2, cols: 5, stampedCount: 5, stripHeight: 120 },
};

export const UnknownIconFallback: Story = {
  args: { rows: 2, stripHeight: 120, iconId: 'unknown' },
};
