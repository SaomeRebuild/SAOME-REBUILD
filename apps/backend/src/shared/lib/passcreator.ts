/**
 * Passcreator API client — back-compat shim.
 *
 * @module shared/lib/passcreator
 *
 * This file is a re-export shim. The actual implementation lives in
 * the `passcreator/` sub-directory split along two protocol boundaries:
 *
 *   V2 template lifecycle:
 *     - v2-template-types.ts  — PasscreatorPassType, PasscreatorFieldType,
 *                               PasscreatorAdditionalProperty, PasscreatorTemplateBody
 *     - v2-template.ts       — createPassTemplate, updatePassTemplate, fetchPassTemplate,
 *                               extractTemplateId, PasscreatorTemplateResponse
 *
 *   V3 per-pass runtime:
 *     - v3-pass-types.ts     — PassIssueHolderData, PassIssueResponse,
 *                               PassBackfillResponse, BARCODE_VALUE_PLACEHOLDERS
 *     - v3-pass.ts           — issuePass, getPassByIdentifier, listPasses,
 *                               normalizeBarcodeValue, extractPassBackfillData
 *
 *   Shared infrastructure:
 *     - env.ts               — PasscreatorEnv, requireEnv
 *     - errors.ts            — PasscreatorErrorEntry, PasscreatorErrorResponse,
 *                               normalizePasscreatorErrorEntries,
 *                               isPasscreatorErrorEnvelope, extractUpstreamErrors
 *     - transport.ts         — passcreatorFetch
 *
 * All existing callers import from `@/shared/lib/passcreator` (this file)
 * and are unchanged. New code is encouraged to import directly from the
 * sub-module files for better tree-shaking and explicit boundaries.
 *
 * Phase history:
 *   - Phase 1 (2026-10-19): extracted env.ts + transport.ts + errors.ts stubs
 *   - Phase 2 (2026-10-19): populated errors.ts helpers
 *   - Phase 3 (2026-10-19): extracted v2-template-types.ts + v2-template.ts
 *   - Phase 4 (2026-10-19): extracted v3-pass-types.ts + v3-pass.ts
 *   - Phase 5 (2026-10-19): test files colocated per source file
 *
 * Rule references:
 *   - Rule 000 Part C.2 (third-party service module structure)
 *   - Rule 019 § D.3 (third-party API is also a contract)
 */

// Re-export PasscreatorEnv (from env.ts)
export { type PasscreatorEnv } from './passcreator/env';

// Re-export error types + helpers (from errors.ts)
export {
  type PasscreatorErrorEntry,
  type PasscreatorErrorResponse,
  type ErrorEnvelopeShape,
  normalizePasscreatorErrorEntries,
  isPasscreatorErrorEnvelope,
  extractUpstreamErrors,
  extractUpstreamErrorsFromArray,
} from './passcreator/errors';

// Re-export transport (from transport.ts)
export { passcreatorFetch, requireEnv } from './passcreator/transport';

// Re-export V2 template types (from v2-template-types.ts)
export {
  type PasscreatorTemplateBody,
  type PasscreatorPassType,
  type PasscreatorAdditionalProperty,
} from './passcreator/v2-template-types';

// Re-export V2 template types: re-export PasscreatorFieldType from v3-pass-types.ts
// (it lives there because it is used by both v2-template body fields AND v3 operations)
export { type PasscreatorFieldType } from './passcreator/v3-pass-types';

// Re-export V2 template functions (from v2-template.ts)
export {
  type PasscreatorTemplateResponse,
  createPassTemplate,
  updatePassTemplate,
  fetchPassTemplate,
} from './passcreator/v2-template';

// Re-export V3 per-pass types (from v3-pass-types.ts)
export {
  type PassIssueHolderData,
  type PassIssueResponse,
  type PassBackfillResponse,
  BARCODE_VALUE_PLACEHOLDERS,
} from './passcreator/v3-pass-types';

// Re-export V3 per-pass functions (from v3-pass.ts)
export { issuePass, getPassByIdentifier, listPasses } from './passcreator/v3-pass';
