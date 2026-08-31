/**
 * ScaleControl — Zoom slider (range input) with min/max icons and current value.
 *
 * Pure presentation. The parent owns the scale state and onChange handler.
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/ScaleControl
 */

import { ZoomIn, ZoomOut } from 'lucide-react';

export interface ScaleControlProps {
  /** Current scale value (rendered as e.g. 1.0x). */
  scale: number;
  /** Slider min value (typically MIN_SCALE = 0.5). */
  min: number;
  /** Slider max value (typically MAX_SCALE = 3.0). */
  max: number;
  /** Slider step (typically 0.1). */
  step: number;
  /** Forwarded change → parent updates CropState. */
  onChange: (newScale: number) => void;
  /** i18n: aria-label for the range input. */
  ariaLabel: string;
}

export function ScaleControl({ scale, min, max, step, onChange, ariaLabel }: ScaleControlProps) {
  return (
    <div className="flex w-full items-center gap-3 px-2">
      <ZoomOut size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={scale}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="flex-1 cursor-pointer"
        aria-label={ariaLabel}
      />
      <ZoomIn size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-12 text-center text-sm font-mono text-muted-foreground">
        {scale.toFixed(1)}x
      </span>
    </div>
  );
}
