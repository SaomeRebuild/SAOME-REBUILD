/**
 * ColorSwatchPicker — Props
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPicker.types
 */

export interface ColorSwatchPickerProps {
  /** Display label above the trigger button (e.g. '背景色'). */
  label: string;
  /** Current color value in internal format (with '#' prefix, e.g. '#FF0000'). */
  value: string;
  /** Called with the new internal-format color ('#FF0000') after validation. */
  onChange: (next: string) => void;
  /** Preset palette to render in the popover (6-char uppercase hex, no '#'). */
  presets: readonly string[];
}
