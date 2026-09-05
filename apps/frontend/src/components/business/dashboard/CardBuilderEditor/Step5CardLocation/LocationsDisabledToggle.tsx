/**
 * LocationsDisabledToggle — Step 5 top-level toggle (Passcreator API
 * `locationsDisabled` field).
 *
 * The toggle is checked (= `locationsDisabled=false`) by default — this
 * means geolocation push-notifications are ENABLED. The user must then
 * configure at least 1 location + locationsMaxDistance to advance past
 * Step 5.
 *
 * When unchecked (= `locationsDisabled=true`):
 *   - The toggle's `setLocationsDisabled(true)` setter clears `locations`
 *     and `locationsMaxDistance` (DB has no stale data).
 *   - Step 5's other sub-components collapse (parent Step5CardLocation
 *     conditionally renders them).
 *   - Workspace `isStep5Valid()` returns true regardless of field state.
 *
 * The label uses a switch-style row (large clickable area) rather than a
 * small checkbox, matching the Step 5 hero-pattern UX.
 */

import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface LocationsDisabledToggleProps {
  /**
   * Reserved for future use — kept for parity with sibling sub-components.
   * Currently unused: the toggle has no validation errors (boolean field).
   */
  showValidation?: boolean;
}

export function LocationsDisabledToggle({ showValidation: _showValidation }: LocationsDisabledToggleProps) {
  const { t } = useTranslation('cardEditor');
  const locationsDisabled = useCardBuilderStore((s) => s.locationsDisabled);
  const setLocationsDisabled = useCardBuilderStore((s) => s.setLocationsDisabled);

  // The toggle's checked state mirrors `!locationsDisabled`: when checked,
  // geolocation is enabled (locationsDisabled=false). When unchecked,
  // geolocation is disabled (locationsDisabled=true).
  const checked = !locationsDisabled;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step5.locationsDisabled.label')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step5.locationsDisabled.helper')}
        </p>
      </header>

      <label
        htmlFor="step5-locations-disabled"
        className={`
          flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4
          transition-all duration-150
          hover:scale-[1.01] hover:border-primary
          active:scale-[0.99]
          ${checked ? 'border-primary' : 'border-border'}
        `}
      >
        <input
          id="step5-locations-disabled"
          type="checkbox"
          checked={checked}
          onChange={(e) => setLocationsDisabled(!e.target.checked)}
          aria-describedby="step5-locations-disabled-hint"
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPin
              size={16}
              aria-hidden="true"
              className={checked ? 'text-primary' : 'text-muted-foreground'}
            />
            <span className="text-sm font-medium text-foreground">
              {checked
                ? t('step5.locationsDisabled.enabledHint')
                : t('step5.locationsDisabled.disabledHint')}
            </span>
          </div>
        </div>
      </label>
    </section>
  );
}