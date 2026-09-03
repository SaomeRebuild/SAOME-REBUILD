import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { COLOR_PRESETS } from '@saome/shared/constants/color-presets';

/**
 * ColorSwatchPicker — 單顆 picker with HSL drag picker + swatch + hex input.
 * For live preview of two pickers (background + text), see
 * Step3CardColors/index.tsx in the actual app.
 */
const meta = {
  title: 'Business/CardBuilder/ColorSwatchPicker',
  component: ColorSwatchPicker,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Label above the trigger button',
    },
    value: {
      control: 'color',
      description: 'Current color (with # prefix)',
    },
  },
} satisfies Meta<typeof ColorSwatchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper that holds state so user can see the value change on click
function InteractivePicker({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="w-72">
      <ColorSwatchPicker
        label="背景色"
        value={value}
        onChange={setValue}
        presets={COLOR_PRESETS}
      />
    </div>
  );
}

export const BackgroundDefault: Story = {
  args: {
    label: '背景色',
    value: '#1A1A1A',
    onChange: () => {},
    presets: COLOR_PRESETS,
  },
  render: () => <InteractivePicker initial="#1A1A1A" />,
};

export const TextDefault: Story = {
  args: {
    label: '文字色',
    value: '#FFFFFF',
    onChange: () => {},
    presets: COLOR_PRESETS,
  },
  render: () => <InteractivePicker initial="#FFFFFF" />,
};

export const CustomSelected: Story = {
  args: {
    label: '背景色',
    value: '#F97316',
    onChange: () => {},
    presets: COLOR_PRESETS,
  },
  render: () => <InteractivePicker initial="#F97316" />,
};

/**
 * CustomHsl — demonstrates drag-style HSL picker for off-palette colors.
 * Click the swatch and drag inside the HSL area to pick any color (e.g. magenta,
 * olive, lavender) that isn't in the 20 presets grid.
 */
export const CustomHsl: Story = {
  args: {
    label: '背景色',
    value: '#8B5CF6',
    onChange: () => {},
    presets: COLOR_PRESETS,
  },
  render: () => <InteractivePicker initial="#8B5CF6" />,
};
