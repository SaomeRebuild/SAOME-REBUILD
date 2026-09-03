/**
 * ColorSwatchPalette — 20-swatch grid (presentational)
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardColors/ColorSwatchPalette
 *
 * Receives an array of 6-char uppercase hex (no '#') and renders a button grid.
 * Clicking a swatch calls `onChange(hex)` (no '#') — caller is responsible
 * for normalizing back to internal format (with '#').
 */

interface ColorSwatchPaletteProps {
  presets: readonly string[];
  /** Internal-format current value (with '#') used to mark the active swatch. */
  selected: string;
  /** Called with the swatch's 6-char hex (no '#') on click. */
  onChange: (hex: string) => void;
}

export function ColorSwatchPalette({ presets, selected, onChange }: ColorSwatchPaletteProps) {
  const selectedNormalized = selected.replace(/^#/, '').toUpperCase();

  return (
    <div
      role="listbox"
      aria-label="Color palette"
      className="grid grid-cols-8 gap-1.5"
    >
      {presets.map((hex) => {
        const isSelected = hex === selectedNormalized;
        return (
          <button
            key={hex}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onChange(hex)}
            title={`#${hex}`}
            className={`
              aspect-square rounded-md border transition-all duration-150
              hover:scale-110 active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${isSelected
                ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-card'
                : 'border-border'
              }
            `}
            style={{ backgroundColor: `#${hex}` }}
          />
        );
      })}
    </div>
  );
}
