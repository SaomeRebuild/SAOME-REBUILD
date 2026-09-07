/**
 * CardFieldKey — display field filter helpers.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE
 *
 * Pure helper functions for selecting which `CARD_FIELDS` entries should
 * be shown in the Step 3 left/right field dropdown, based on the current
 * `cardType`. Kept in its own file so that `Step3CardFields/index.tsx`
 * can stay a "components-only" file (the
 * `react(only-export-components)` lint rule requires components to be the
 * sole export of a module so React Fast Refresh works correctly).
 *
 * See: https://github.com/oxlint/oxlint/blob/main/src/rules/react/only_export_components.rs
 */

import { CARD_FIELDS, type CardFieldDefinition } from '@saome/shared/constants/card-fields';
import type { CardType } from '@saome/shared/schemas/card';

/**
 * Card types for which the stamp-only display fields (availableRewards /
 * totalStamps / stampsRemaining) are shown in the dropdown.
 *
 * Mirrors the conditional render guard used in `CardBuilderEditorWorkspace`
 * for `<Step3StampGrid />` — both are driven by the same `cardType` value,
 * so the user sees the stamp fields only when the stamp grid section is
 * also visible. Keeping this set local to this module (rather than imported
 * from a shared module) avoids a cross-module coupling for a 2-element
 * constant.
 */
export const STAMP_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
  'multipass',
]);

/**
 * Decide which `CARD_FIELDS` entries are visible for the given card type.
 *
 * - 'common' group fields are always shown.
 * - 'stamp' group fields are shown only when cardType ∈ STAMP_CARD_TYPES.
 *
 * The function is pure and exported so the conformance test
 * (`Step3CardFields/index.test.tsx`) can assert the filter directly
 * without needing to mock the store. Returns full `CardFieldDefinition`
 * entries (including `labelKey`) so the consumer can pass the array
 * straight through to `<FieldSelect>`.
 */
export function filterCARD_FIELDS_BY_CARD_TYPE(
  cardType: CardType | null,
): readonly CardFieldDefinition[] {
  const showStampGroup = cardType !== null && STAMP_CARD_TYPES.has(cardType);
  return CARD_FIELDS.filter(
    (f) => f.group === 'common' || showStampGroup,
  );
}
