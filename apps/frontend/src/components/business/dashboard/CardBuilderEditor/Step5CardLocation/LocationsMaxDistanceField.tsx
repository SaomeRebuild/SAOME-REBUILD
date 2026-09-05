/**
 * LocationsMaxDistanceField — Step 5 section between initialMessage and locations
 * (Passcreator "locationsMaxDistance", aka Apple Wallet / PassKit notification radius).
 *
 * Renders a number input (text-mode to support clear-to-null) with a unit
 * suffix, a live hint describing the valid range, and a "use default" button
 * that clears the field back to `null` (PassKit's pass-type-default behaviour).
 *
 * 2026-09-06 rename: was `NotificationRadiusField`. Renamed to align the
 * UI label with the Passcreator API field name (`locationsMaxDistance`).
 * The validation / clamp / clear semantics are unchanged.
 *
 * Behavior:
 *   - Empty / blank input → `setLocationsMaxDistance(null)` (use default)
 *   - Numeric string within range → parseInt → clamp → setLocationsMaxDistance
 *   - Out-of-range / non-numeric → show error (red border + i18n message)
 *   - "Use default" button → `setLocationsMaxDistance(null)` + clear input
 *
 * The Passcreator spec says values outside [100, 1000] are silently ignored.
 * We surface that as a validation error so the user knows their input did
 * not take effect.
 */

import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { parseLocationsMaxDistance } from '@saome/shared/logic/locations';
import {
  LOCATIONS_MAX_DISTANCE_MIN,
  LOCATIONS_MAX_DISTANCE_MAX,
} from '@saome/shared/constants/card-back-fields';

interface LocationsMaxDistanceFieldProps {
  /**
   * Surface the field's validation error. Step 5 has no required fields
   * when `locationsDisabled=true`; this prop is forwarded so the field
   * stays consistent with sibling Step 5 sub-components.
   */
  showValidation: boolean;
}

export function LocationsMaxDistanceField({ showValidation }: LocationsMaxDistanceFieldProps) {
  const { t } = useTranslation('cardEditor');
  const locationsMaxDistance = useCardBuilderStore((s) => s.locationsMaxDistance);
  const setLocationsMaxDistance = useCardBuilderStore((s) => s.setLocationsMaxDistance);

  // Local UI state mirrors the store but also holds the raw string so
  // the user can type without fighting the browser's number-input quirks.
  // When `locationsMaxDistance` is null we render the empty placeholder.
  const [rawValue, setRawValue] = useState(
    locationsMaxDistance === null ? '' : String(locationsMaxDistance),
  );
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setRawValue(raw);
    setError(null);

    if (raw.trim() === '') {
      // Empty → clear to pass-type default
      setLocationsMaxDistance(null);
      return;
    }

    const parsed = parseLocationsMaxDistance(raw);
    if (parsed === null) {
      // Empty string was already handled above; if we reach here with null
      // it means parseLocationsMaxDistance returned null (shouldn't happen
      // for non-empty strings), but guard anyway.
      setLocationsMaxDistance(null);
      return;
    }
    if (typeof parsed === 'number') {
      setLocationsMaxDistance(parsed);
      setError(null);
    } else {
      // Validation error — keep the raw string so user can edit it
      setError(parsed.message);
    }
  }

  function handleClear() {
    setRawValue('');
    setLocationsMaxDistance(null);
    setError(null);
  }

  const hasError = error !== null;
  const showDestructiveBorder = showValidation && hasError;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step5.locationsMaxDistance.label')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step5.locationsMaxDistance.helper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="step5-locations-max-distance"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={rawValue}
              onChange={handleChange}
              placeholder={t('step5.locationsMaxDistance.placeholder')}
              aria-invalid={showDestructiveBorder ? 'true' : undefined}
              aria-describedby={
                hasError
                  ? 'step5-locations-max-distance-error'
                  : 'step5-locations-max-distance-hint'
              }
              autoComplete="off"
              className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 pr-12 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                showDestructiveBorder
                  ? 'border-destructive focus-visible:ring-destructive'
                  : 'border-input'
              }`}
            />
            {/* Unit suffix — overlaid inside the input */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            >
              {t('step5.locationsMaxDistance.unit')}
            </span>
          </div>

          {/* "Use default" button — only visible when the field has a value */}
          {locationsMaxDistance !== null && (
            <button
              type="button"
              onClick={handleClear}
              className="
                inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3
                text-xs font-medium text-muted-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              "
            >
              {t('step5.locationsMaxDistance.useDefault')}
            </button>
          )}
        </div>

        {/* Hint or error message */}
        <div className="flex items-center justify-between gap-2">
          {hasError ? (
            <p
              id="step5-locations-max-distance-error"
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(error)}
            </p>
          ) : (
            <p
              id="step5-locations-max-distance-hint"
              className="text-xs text-muted-foreground"
            >
              {t('step5.locationsMaxDistance.rangeHint', {
                min: LOCATIONS_MAX_DISTANCE_MIN,
                max: LOCATIONS_MAX_DISTANCE_MAX,
              })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}