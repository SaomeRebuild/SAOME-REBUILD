/**
 * BackFieldsField — Step 4 section 2 (背面欄位).
 *
 * Renders a list of Label + Value rows. Always shows at least one row
 * (BACK_FIELDS_MIN=1 is enforced by `removeBackField` auto-refilling).
 * Each row's `value` is REQUIRED — the error message only appears when
 * `showValidation && value.trim() === ''`.
 *
 * Apple EULA: at least one back field must contain valid contact info
 * (see the i18n `step4.backFields.hint` for the full text). The runtime
 * enforcement lives in `isStep4Valid()`; this component only flags the
 * empty-value rows visually.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Responsibility split (added 2026-09-05 — fixing Step 4 plan 修一):
 *   - BackFieldsField: only checks `non-empty`. Apple EULA mandates a
 *     contact row, but the runtime render accepts any non-empty text
 *     (prose, address, raw phone digits, etc.). Do NOT pipe `isValidUrl()`
 *     here — back fields are not URLs.
 *   - LinksField: uses `isValidUrl()` (URL / phone / email fallback)
 *     because links are actionable URLs that the wallet will navigate to.
 * The two fields do NOT share a `validateValue` callback. See
 * `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/LinksField.tsx`
 * for the URL-shape side. Mixing them causes the user-visible bug
 * "back fields checking the Link field's format".
 * ─────────────────────────────────────────────────────────────────────
 */

import { useCardBuilderStore } from '../CardBuilderEditor.store';
import {
  BACK_FIELDS_MAX,
} from '@saome/shared/constants/card-back-fields';
import { LabelValueListField } from './LabelValueListField';

interface BackFieldsFieldProps {
  showValidation: boolean;
}

export function BackFieldsField({ showValidation }: BackFieldsFieldProps) {
  const rows = useCardBuilderStore((s) => s.backFields);
  const setBackFieldsLabel = useCardBuilderStore((s) => s.setBackFieldsLabel);
  const setBackFieldsValue = useCardBuilderStore((s) => s.setBackFieldsValue);
  const addBackField = useCardBuilderStore((s) => s.addBackField);
  const removeBackField = useCardBuilderStore((s) => s.removeBackField);

  // For backFields, value is required — only "non-empty" rows pass.
  // NOTE: this is `non-empty` only, NOT URL/phone/email-shape validation.
  // Apple Wallet renders the value as plain contact text, so any non-empty
  // input is acceptable (a multi-line address is a legitimate back field).
  const validateValue = (value: string) => value.trim().length > 0;

  return (
    <LabelValueListField
      titleKey="step4.backFields.title"
      hintKey="step4.backFields.hint"
      addLabelKey="step4.backFields.addField"
      counterKey="step4.backFields.counter"
      maxReachedKey="step4.backFields.maxReached"
      rows={rows}
      max={BACK_FIELDS_MAX}
      onLabelChange={setBackFieldsLabel}
      onValueChange={setBackFieldsValue}
      onAdd={addBackField}
      onRemove={removeBackField}
      validateValue={validateValue}
      valueErrorKey="step4.backFields.required"
      labelPlaceholderKey="step4.backFields.labelPlaceholder"
      valuePlaceholderKey="step4.backFields.valuePlaceholder"
      removeLabelKey="step4.backFields.removeField"
      showValidation={showValidation}
      // Render the value field as a multi-line textarea (added 2026-09-05);
      // Apple Wallet's back fields accept arbitrary text including multi-line
      // addresses / contact info. Links stay single-line — see LinksField.tsx.
      valueMultiline
    />
  );
}