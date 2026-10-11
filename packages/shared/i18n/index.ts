/**
 * Shared i18n utilities for SAOME.
 *
 * Re-exports language detection helpers used by both Web and React Native.
 *
 * Also re-exports the field-labels i18n module (2026-10-11, Passcreator
 * integration). The frontend `passCard.{zh-TW,en}.ts` SPREADS the labels
 * so the editor preview and the deployed pass stay in sync. The backend
 * `passTemplateMapping.ts` reads from the same source for Passcreator
 * `headerFields[].label` / `primaryFields[].label` / etc.
 */
export {
  detectDeviceLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './detectLanguage';

export {
  getFieldLabel,
  getFieldLabelMap,
  getSlotNames,
  getBackSideLabels,
  getDefaults,
  getPreviewPillLabels,
  getFieldPreviewLabel,
  type PassLanguage,
  type FieldLabels,
} from './fieldLabels';
