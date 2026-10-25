/**
 * Typed domain errors for the Pass runtime value model.
 *
 * @module shared/logic/passValueErrors
 * @description The ONE error type the shared pass-value layer raises.
 *
 * WHY A DOMAIN ERROR (and not a ZodError)
 *
 * The reducer (`passValueCalculator.ts`) runs inside the backend's DB
 * transaction. A raw `ZodError` escaping it is indistinguishable
 * from a bug: the caller sees a 500, the event is lost with the
 * rolled-back transaction, and the business reason ("this holder
 * already has a registration event") never reaches the client.
 *
 * A domain error separates the two:
 *
 *   - `code` — a stable, i18n-key-shaped identifier. THIS is what
 *     gets translated (Rule 023 § Shared Validation 用 i18n Key).
 *   - `message` — a developer-facing English string for the logs. It
 *     is NEVER translated and NEVER shown to an end user.
 *   - `details` — structured context (metric, value, timestamp) so
 *     a caller can log or map the failure without string-matching the
 *     message.
 *
 * The `code` union is intentionally tiny: it is the vocabulary the
 * API layer maps to HTTP status codes, and every new member is a
 * contract change.
 *
 * Rule references:
 *   - Rule 023 § Shared Validation 用 i18n Key — `code` is an i18n
 *     key, never a user-facing string.
 *   - Rule 024 § Mobile Future-Proof — a plain class, no platform API.
 *
 * @see packages/shared/logic/passValueCalculator.ts — the reducer
 */

/**
 * The vocabulary the API layer maps to HTTP status codes.
 *
 *   - `duplicateRegistered` — a holder ledger holds more than one
 *     `registered` event. The DATABASE makes this unreachable
 *     (migration 029's partial unique index) and the backend
 *     registration service turns the DB rejection into an idempotent
 *     replay, so the reducer does not raise this one.
 *   - `negativeMetric` — an event would push a non-negative metric
 *     below zero (an over-spend). Decision Log 決定八: the event is
 *     REJECTED, never clamped.
 *   - `invalidDelta` — a delta is not legal for the metric it
 *     targets (fractional for a whole-number metric, or not
 *     finite). Decision Log 決定十.
 *
 * Every new member is a contract change — the API layer maps each
 * code to a status, so the union stays deliberately tiny.
 */
export const PASS_VALUE_ERROR_CODES = [
  'passValue.error.duplicateRegistered',
  'passValue.error.negativeMetric',
  'passValue.error.invalidDelta',
] as const;

export type PassValueErrorCode = (typeof PASS_VALUE_ERROR_CODES)[number];

/**
 * A business-rule violation in the Pass runtime value model.
 *
 * Thrown by the reducer; the API layer is expected to translate
 * `code` into a 4xx response instead of letting it become a 500.
 */
export class PassValueDomainError extends Error {
  readonly code: PassValueErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: PassValueErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PassValueDomainError';
    this.code = code;
    this.details = details ?? {};
  }
}
