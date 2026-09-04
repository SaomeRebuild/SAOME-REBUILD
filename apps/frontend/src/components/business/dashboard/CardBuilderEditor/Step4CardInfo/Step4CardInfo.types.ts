/**
 * Step4CardInfo — internal types shared across the folder's components.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step4CardInfo/Step4CardInfo.types
 */

import type { LabelValuePair } from '../CardBuilderEditor.store';

export interface LabelValueRowProps {
  /** Zero-based index in the parent list. */
  idx: number;
  /** Currently-typed label text (controlled). */
  label: string;
  /** Currently-typed value text (controlled). */
  value: string;
  /** i18n key path to the label placeholder (e.g. `step4.backFields.labelPlaceholder`). */
  labelPlaceholderKey: string;
  /** i18n key path to the value placeholder (e.g. `step4.backFields.valuePlaceholder`). */
  valuePlaceholderKey: string;
  /** Optional i18n key path to an error message shown under the value input. */
  valueErrorKey?: string;
  /** Show destructive red border on value input. */
  showValidation: boolean;
  /** i18n key path to the remove button aria-label / visible label. */
  removeLabelKey: string;
  /**
   * Render the value field as a multiline `<textarea>` with auto-grow
   * (added 2026-09-05 for back fields). Pass `true` for back fields where
   * Apple EULA permits multi-line contact info. Pass `false` (or omit) for
   * links where a single-line URL is the spec.
   */
  valueMultiline?: boolean;
  onLabelChange: (next: string) => void;
  onValueChange: (next: string) => void;
  onRemove: () => void;
}

export interface LabelValueListFieldProps {
  /** Section title i18n key (e.g. `step4.backFields.title`). */
  titleKey: string;
  /** Hint paragraph i18n key (e.g. `step4.backFields.hint`). */
  hintKey: string;
  /** Add-button label i18n key (e.g. `step4.backFields.addField`). */
  addLabelKey: string;
  /** Counter i18n key with `{{count}}` placeholder. */
  counterKey: string;
  /** Max-reached hint i18n key (e.g. `step4.backFields.maxReached`). */
  maxReachedKey: string;
  /** Current rows. */
  rows: LabelValuePair[];
  /** Hard cap; the add button is disabled when `rows.length >= max`. */
  max: number;
  /** Disable destructive border on every row (used when section is OPTIONAL, e.g. links). */
  optional?: boolean;
  /**
   * Forwarded to each row — see {@link LabelValueRowProps.valueMultiline}.
   */
  valueMultiline?: boolean;
  /** Per-row update callbacks. */
  onLabelChange: (idx: number, label: string) => void;
  onValueChange: (idx: number, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  /** Per-row value validity test (returns true when row is OK; false triggers error UI). */
  validateValue: (value: string) => boolean;
  /** i18n key for the value-required / invalid-url error message shown under a failing row. */
  valueErrorKey: string;
  /** i18n key for the label-input placeholder. */
  labelPlaceholderKey: string;
  /** i18n key for the value-input placeholder. */
  valuePlaceholderKey: string;
  /** i18n key for the row remove button (visible text and aria-label). */
  removeLabelKey: string;
  /** Whether to surface validation errors. From parent (`showValidation` prop). */
  showValidation: boolean;
}