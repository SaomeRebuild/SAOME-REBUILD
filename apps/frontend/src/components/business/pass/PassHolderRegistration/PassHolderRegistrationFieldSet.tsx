/**
 * PassHolderRegistrationFieldSet — extension slot for card-type-specific
 * fields. Today a passthrough wrapper so the L2 main signature is stable;
 * future plans add a `switch (cardType)` here to render dedicated sub-forms
 * (e.g. reward card tier picker, coupon count selector).
 *
 * Contract (per plan 2026-09-28):
 *   - Props: { cardType, children? }
 *   - Renders: <div data-testid="card-type-fieldset">{children}</div>
 *   - Main component (`PassHolderRegistration`) does NOT change when
 *     extension fields are added — only this file does.
 */

import type { PassHolderRegistrationFieldSetProps } from './PassHolderRegistration.types';

export function PassHolderRegistrationFieldSet({
  cardType,
  children,
}: PassHolderRegistrationFieldSetProps) {
  return (
    <div
      data-testid="card-type-fieldset"
      data-card-type={cardType}
      className="flex flex-col gap-4"
    >
      {children}
    </div>
  );
}