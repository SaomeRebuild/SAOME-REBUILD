/**
 * Centralized error type for all saome-backend modules.
 *
 * @module shared/lib/saomeError
 * @description All modules throw `SaomeError` (or subclasses). The global
 * `errorHandler` middleware reads `error.status`, `error.code`, and
 * `error.i18nKey` to build the JSON response.
 *
 * Conventions:
 *   - `code` is a SCREAMING_SNAKE_CASE stable identifier (logged + surfaced to client)
 *   - `i18nKey` is the i18next key the frontend uses for human-readable text
 *   - `status` is the HTTP status code
 *   - `details` is opaque context (e.g., field-level validation errors)
 *
 * Layered design:
 *   - `SaomeError` (base)
 *   - `ValidationError` (400) — zod parse failure
 *   - `AuthError` (401) — invalid credentials / missing token
 *   - `ForbiddenError` (403) — wrong role / inactive account
 *   - `NotFoundError` (404)
 *   - `ConflictError` (409) — duplicate email, tax_id collision
 *   - `RateLimitError` (429) — too many failed login attempts
 *   - `ServerError` (500) — unexpected / unhandled
 */

/**
 * Base error type for all saome-backend errors.
 *
 * @example
 *   throw new SaomeError({
 *     status: 409,
 *     code: 'EMAIL_TAKEN',
 *     i18nKey: 'auth.error.emailTaken',
 *     message: 'Email already in use',
 *   });
 */
export class SaomeError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly i18nKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly details?: Record<string, any>;

  constructor(init: {
    status: number;
    code: string;
    i18nKey: string;
    message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: Record<string, any>;
  }) {
    super(init.message);
    this.name = 'SaomeError';
    this.status = init.status;
    this.code = init.code;
    this.i18nKey = init.i18nKey;
    this.details = init.details;
  }
}

/**
 * 400 Bad Request — typically zod validation failure.
 */
export class ValidationError extends SaomeError {
  constructor(i18nKey = 'common.error.validationFailed', details?: Record<string, unknown>) {
    super({
      status: 400,
      code: 'VALIDATION_ERROR',
      i18nKey,
      message: 'Validation failed',
      details,
    });
    this.name = 'ValidationError';
  }
}

/**
 * 401 Unauthorized — missing / invalid / expired token.
 */
export class AuthError extends SaomeError {
  constructor(i18nKey = 'common.error.unauthorized', message = 'Unauthorized') {
    super({ status: 401, code: 'UNAUTHORIZED', i18nKey, message });
    this.name = 'AuthError';
  }
}

/**
 * 403 Forbidden — authenticated but lacks permission / wrong role.
 */
export class ForbiddenError extends SaomeError {
  constructor(i18nKey = 'common.error.forbidden', message = 'Forbidden') {
    super({ status: 403, code: 'FORBIDDEN', i18nKey, message });
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found.
 */
export class NotFoundError extends SaomeError {
  constructor(i18nKey = 'common.error.notFound', message = 'Not found') {
    super({ status: 404, code: 'NOT_FOUND', i18nKey, message });
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict — duplicate email, tax_id collision, etc.
 */
export class ConflictError extends SaomeError {
  constructor(i18nKey: string, message: string, details?: Record<string, unknown>) {
    super({ status: 409, code: 'CONFLICT', i18nKey, message, details });
    this.name = 'ConflictError';
  }
}

/**
 * 429 Too Many Requests — rate limit hit.
 */
export class RateLimitError extends SaomeError {
  public readonly retryAfterSec: number;

  constructor(retryAfterSec: number, i18nKey = 'auth.error.locked', details?: Record<string, unknown>) {
    super({
      status: 429,
      code: 'RATE_LIMITED',
      i18nKey,
      message: `Too many requests. Retry after ${retryAfterSec}s.`,
      details: { ...details, retryAfterSec },
    });
    this.name = 'RateLimitError';
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * 500 Internal Server Error — wrapped at the errorHandler boundary.
 */
export class ServerError extends SaomeError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(originalError?: unknown, details?: Record<string, any>) {
    super({
      status: 500,
      code: 'INTERNAL_ERROR',
      i18nKey: 'common.error.internal',
      message: 'Internal server error',
      details: {
        ...details,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        original: originalError instanceof Error ? { name: originalError.name, message: originalError.message } : undefined,
      },
    });
    this.name = 'ServerError';
  }
}