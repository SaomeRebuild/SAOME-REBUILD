/**
 * LocationsField — Step 5 section (地點).
 *
 * Wraps the dynamic list of LocationRow entries with a section header,
 * a helper paragraph (verbatim from Passcreator docs), an "Add location"
 * button, and a max-hint that flips to "Max 10 reached" at the cap.
 *
 * 2026-09-06 refactor:
 *   - When `locationsDisabled=false` (toggle ON), the workspace enforces
 *     "at least 1 location row" via `isStep5Valid()`. The empty-state
 *     placeholder text reflects this: instead of "最多 10 個地點" the
 *     hint says "請新增至少 1 個地點" to nudge the user toward adding one.
 *
 * Empty initial state: the array starts as `[]`. The user clicks the
 * add button to seed the first row; subsequent rows append. Removes are
 * non-refilling (matches `removeLink` semantics — locations are optional
 * only when `locationsDisabled=true`).
 */

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { LOCATIONS_MAX } from '@saome/shared/constants/card-back-fields';
import { LocationRow } from './LocationRow';

interface LocationsFieldProps {
  showValidation: boolean;
}

export function LocationsField({ showValidation }: LocationsFieldProps) {
  const { t } = useTranslation('cardEditor');
  const locations = useCardBuilderStore((s) => s.locations);
  const addLocation = useCardBuilderStore((s) => s.addLocation);

  const atMax = locations.length >= LOCATIONS_MAX;
  const counterText = t('step5.locations.counter', { count: locations.length });

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-6">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step5.locations.title')}
        </h3>
        {/* Passcreator docs (verbatim, translated): "Based on this data a
            Wallet pass is shown on the user's lockscreen as soon as he's
            near a defined location or the relevant date is reached." */}
        <p className="text-sm text-muted-foreground">
          {t('step5.locations.sectionHelper')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('step5.locations.coordinatesHelper')}
        </p>
      </header>

      {/* Empty-state placeholder when no locations yet (toggled to destructive
          red because the workspace `isStep5Valid()` blocks "Next" until at
          least 1 row is added). */}
      {locations.length === 0 && (
        <p className="rounded-md border border-dashed border-destructive bg-destructive/5 px-3 py-4 text-center text-sm text-destructive">
          {t('step5.locations.locationsMinOneHint')}
        </p>
      )}

      {/* Locations list */}
      <div className="flex flex-col gap-3">
        {locations.map((_loc, idx) => (
          <LocationRow
            key={idx}
            idx={idx}
            showValidation={showValidation}
            removeLabelKey="step5.locations.removeLocation"
          />
        ))}
      </div>

      {/* Add button + counter hint */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{counterText}</span>
        <button
          type="button"
          onClick={addLocation}
          disabled={atMax}
          className="
              inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2
              text-sm font-medium text-foreground
              transition-all duration-150
              hover:scale-[1.02] hover:border-primary hover:text-primary
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:border-input disabled:hover:text-foreground
            "
        >
          <Plus size={16} aria-hidden="true" />
          {t('step5.locations.addLocation')}
        </button>
      </div>
      {atMax && (
        <p className="text-xs text-muted-foreground">
          {t('step5.locations.maxReached')}
        </p>
      )}
    </section>
  );
}