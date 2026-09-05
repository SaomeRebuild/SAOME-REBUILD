/**
 * LocationRow — single editable row inside Step 5 Locations section.
 *
 * Renders the three primary inputs (store name, coordinates paste input,
 * relevant text) plus a remove button. Step 5 ships the minimum fields
 * needed to drive an Apple Wallet `relevantLocations` trigger:
 *   - `name` (user-facing label, required)
 *   - `latitude` / `longitude` (REQUIRED — pasted via Google Maps format)
 *   - `relevantText` (optional, lock-screen message ≤ 100 chars)
 *
 * 2026-09-06 refactor:
 *   - lat/lng are now REQUIRED (red border when NaN / out-of-range +
 *     showValidation=true).
 *   - Added `relevantText` input field (Apple Wallet `relevantText` field).
 *
 * RWD (Rule 013 + 014):
 *   - < 768px (default): stacked 1 column
 *   - ≥ 768px (`md:`): side-by-side 2 columns for the primary inputs,
 *     with relevantText on a second row spanning both columns
 *
 * Paste-to-split behavior: when the user pastes into the coordinates
 * input, the clipboard text is run through `parseCoordinatePaste` from
 * `packages/shared/logic/locations.ts`. On success, both `latitude` and
 * `longitude` are written to the store in a single batched update; on
 * failure, the input is left untouched and the corresponding i18n error
 * message is rendered under the field.
 */

import { useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { parseCoordinatePaste } from '@saome/shared/logic/locations';
import {
  LOCATION_NAME_MAX_LENGTH,
  RELEVANT_TEXT_MAX_LENGTH,
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
} from '@saome/shared/constants/card-back-fields';

interface LocationRowProps {
  /** Zero-based index in the parent locations list. */
  idx: number;
  /**
   * Show the destructive red border on invalid rows. Step 5 enforces
   * required fields (name + lat + lng) when `locationsDisabled=false`:
   * an invalid row blocks the user from leaving the step.
   */
  showValidation: boolean;
  /** Setter forwarded from parent to share validation timing. */
  removeLabelKey: string;
}

/**
 * Map a `LocationValidationError.type` to the corresponding i18n key.
 * Centralized so the row renders one source of truth for error display.
 */
function errorTypeToI18nKey(
  type:
    | 'invalidFormat'
    | 'latitudeOutOfRange'
    | 'longitudeOutOfRange'
    | 'nameEmpty'
    | 'nameTooLong'
    | 'latitudeRequired'
    | 'longitudeRequired'
    | 'relevantTextTooLong',
): string {
  return `step5.locations.validation.${type}`;
}

export function LocationRow({ idx, showValidation, removeLabelKey }: LocationRowProps) {
  const { t } = useTranslation('cardEditor');

  // Store bindings — selector pattern keeps re-renders narrow.
  const row = useCardBuilderStore((s) => s.locations[idx]);
  const setLocationName = useCardBuilderStore((s) => s.setLocationName);
  const setLocationLatitude = useCardBuilderStore((s) => s.setLocationLatitude);
  const setLocationLongitude = useCardBuilderStore((s) => s.setLocationLongitude);
  const setLocationRelevantText = useCardBuilderStore((s) => s.setLocationRelevantText);
  const removeLocation = useCardBuilderStore((s) => s.removeLocation);

  // Local UI state for the paste input + paste error. The store only
  // gets lat/lng written after a successful paste parse — the input box
  // is intentionally NOT bound to store.latitude/store.longitude to keep
  // the paste-to-split flow the only way to populate them.
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteRaw, setPasteRaw] = useState<string>('');

  // Defensive: a stale `row` reference can happen if `addLocation` is
  // called and the new row hasn't propagated yet. Render a minimal
  // placeholder rather than crashing.
  if (!row) return null;

  const removeLabel = t(removeLabelKey);

  // Validation per field — independent flags so the row can show
  // multiple errors at once (a row with name='' AND bad lat AND bad lng
  // surfaces all three in one render).
  const nameEmpty = row.name.trim() === '';
  const nameTooLong = row.name.length > LOCATION_NAME_MAX_LENGTH;
  const latMissing = !Number.isFinite(row.latitude);
  const latBad =
    latMissing || row.latitude < LATITUDE_MIN || row.latitude > LATITUDE_MAX;
  const lngMissing = !Number.isFinite(row.longitude);
  const lngBad =
    lngMissing || row.longitude < LONGITUDE_MIN || row.longitude > LONGITUDE_MAX;
  const relevantTextTooLong =
    typeof row.relevantText === 'string' &&
    row.relevantText.length > RELEVANT_TEXT_MAX_LENGTH;

  /**
   * Paste handler — splits the clipboard into lat/lng. We call
   * `e.preventDefault()` first so the pasted text does NOT also land in
   * the raw input (which would otherwise show "25.033,121.565" in the
   * coordinates field forever, masking the parsed lat/lng behind it).
   */
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    setPasteRaw(text);
    const parsed = parseCoordinatePaste(text);
    if ('latitude' in parsed) {
      setPasteError(null);
      // Single batched write so autosave sees one snapshot.
      setLocationLatitude(idx, parsed.latitude);
      setLocationLongitude(idx, parsed.longitude);
    } else {
      setPasteError(parsed.message);
    }
  }

  function handlePasteChange(e: ChangeEvent<HTMLInputElement>) {
    // Track raw text locally so the input box remains usable as a
    // manual fallback; do NOT push into the store. Clear stale error.
    setPasteRaw(e.target.value);
    if (pasteError) setPasteError(null);
  }

  // Border class for the coordinates paste input — destructive only when
  // the user has typed/pasted AND validation is on AND there's an error.
  const coordsError =
    showValidation && (pasteError !== null || latBad || lngBad)
      ? 'border-destructive focus-visible:ring-destructive'
      : 'border-input';
  const nameErrorBorder =
    showValidation && (nameEmpty || nameTooLong)
      ? 'border-destructive focus-visible:ring-destructive'
      : 'border-input';
  const relevantTextErrorBorder =
    showValidation && relevantTextTooLong
      ? 'border-destructive focus-visible:ring-destructive'
      : 'border-input';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
        {/* Store name (required per row — `name` field) */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`step5-location-${idx}-name`}
            className="text-xs font-medium text-muted-foreground md:sr-only"
          >
            {t('step5.locations.storeNameLabel')}
          </label>
          <input
            id={`step5-location-${idx}-name`}
            type="text"
            value={row.name}
            onChange={(e) => setLocationName(idx, e.target.value)}
            placeholder={t('step5.locations.storeNamePlaceholder')}
            autoComplete="off"
            maxLength={LOCATION_NAME_MAX_LENGTH}
            aria-invalid={showValidation && (nameEmpty || nameTooLong) ? 'true' : undefined}
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${nameErrorBorder}`}
          />
          {showValidation && nameEmpty && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('nameEmpty'))}
            </p>
          )}
          {showValidation && nameTooLong && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('nameTooLong'))}
            </p>
          )}
        </div>

        {/* Coordinates paste input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`step5-location-${idx}-coords`}
            className="text-xs font-medium text-muted-foreground md:sr-only"
          >
            {t('step5.locations.coordinatesLabel')}
          </label>
          <input
            id={`step5-location-${idx}-coords`}
            type="text"
            value={pasteRaw}
            onPaste={handlePaste}
            onChange={handlePasteChange}
            placeholder={t('step5.locations.coordinatesPlaceholder')}
            autoComplete="off"
            aria-invalid={
              showValidation && (pasteError !== null || latBad || lngBad)
                ? 'true'
                : undefined
            }
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${coordsError}`}
          />
          {/* Show a successful parse confirmation as a tiny muted hint —
              gives the user feedback that the split worked. */}
          {!pasteError &&
            !latBad &&
            !lngBad && (
              <p className="text-xs text-muted-foreground">
                {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)}
              </p>
            )}
          {showValidation && latMissing && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('latitudeRequired'))}
            </p>
          )}
          {showValidation && !latMissing && latBad && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('latitudeOutOfRange'))}
            </p>
          )}
          {showValidation && lngMissing && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('longitudeRequired'))}
            </p>
          )}
          {showValidation && !lngMissing && lngBad && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(errorTypeToI18nKey('longitudeOutOfRange'))}
            </p>
          )}
          {pasteError && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              {t(pasteError)}
            </p>
          )}
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={() => removeLocation(idx)}
          aria-label={removeLabel}
          title={removeLabel}
          className="
              inline-flex h-10 w-10 items-center justify-center self-start rounded-md border border-input bg-background
              text-muted-foreground transition-all duration-150
              hover:scale-[1.02] hover:border-destructive hover:text-destructive
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              md:self-center
            "
        >
          <Trash size={16} aria-hidden="true" />
        </button>
      </div>

      {/* relevantText — lock-screen message (optional, ≤ 100 chars) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`step5-location-${idx}-relevant-text`}
          className="text-xs font-medium text-muted-foreground"
        >
          {t('step5.locations.relevantTextLabel')}
        </label>
        <input
          id={`step5-location-${idx}-relevant-text`}
          type="text"
          value={row.relevantText ?? ''}
          onChange={(e) =>
            setLocationRelevantText(idx, e.target.value === '' ? null : e.target.value)
          }
          placeholder={t('step5.locations.relevantTextPlaceholder')}
          autoComplete="off"
          maxLength={RELEVANT_TEXT_MAX_LENGTH}
          aria-invalid={showValidation && relevantTextTooLong ? 'true' : undefined}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${relevantTextErrorBorder}`}
        />
        {showValidation && relevantTextTooLong && (
          <p
            className="text-xs"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            {t(errorTypeToI18nKey('relevantTextTooLong'))}
          </p>
        )}
      </div>
    </div>
  );
}