/**
 * Step5CardLocation — Step 5 wizard section (地理位置 + 推播訊息).
 *
 * 2026-09-06 refactor:
 *   - Adds <LocationsDisabledToggle /> at the top (Passcreator `locationsDisabled`).
 *   - When toggle is OFF (locationsDisabled=true), collapses the body and
 *     shows a "已停用" hint instead of the location/radius/message fields.
 *   - The parent (CardBuilderEditorWorkspace) owns prev/next buttons; this
 *     component is purely the editor body.
 *
 * Composes four sub-components when enabled:
 *   1. <LocationsDisabledToggle />  — toggle (always visible, top)
 *   2. <InitialMessageField />      — push-notification body (optional)
 *   3. <LocationsMaxDistanceField />— pass-level notification radius
 *   4. <LocationsField />           — geolocation triggers (optional, up to 10)
 *
 * When the toggle is OFF, only the toggle + a small helper paragraph
 * render; the user can advance to Step 6 with no other input.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { LocationsDisabledToggle } from './LocationsDisabledToggle';
import { InitialMessageField } from './InitialMessageField';
import { LocationsMaxDistanceField } from './LocationsMaxDistanceField';
import { LocationsField } from './LocationsField';

interface Step5CardLocationProps {
  /**
   * Surface per-field validation errors. Step 5 only enforces required
   * fields when `locationsDisabled=false` (toggle ON); when OFF, the
   * workspace lets the user skip regardless of field state. The prop is
   * forwarded to all sub-components for parity with the previous design.
   */
  showValidation: boolean;
}

export function Step5CardLocation({ showValidation }: Step5CardLocationProps) {
  const { t } = useTranslation('cardEditor');
  const locationsDisabled = useCardBuilderStore((s) => s.locationsDisabled);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <LocationsDisabledToggle showValidation={showValidation} />

      {locationsDisabled ? (
        // Toggle OFF → geolocation disabled. Show a small helper paragraph
        // explaining the state; do not render the location-related fields
        // (they were cleared by `setLocationsDisabled(true)` setter).
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
          {t('step5.skipNotice')}
        </p>
      ) : (
        <>
          <InitialMessageField showValidation={showValidation} />
          <LocationsMaxDistanceField showValidation={showValidation} />
          <LocationsField showValidation={showValidation} />
        </>
      )}
    </div>
  );
}