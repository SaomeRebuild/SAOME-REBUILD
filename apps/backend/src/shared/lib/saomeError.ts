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

/**
 * 502 Bad Gateway — upstream service returned a non-2xx response or
 * was unreachable. Used by the Passcreator integration (Step 8
 * "Save & Publish") to signal that the local template was NOT pushed
 * to Passcreator, and therefore the DB write must be rolled back.
 *
 * Why a dedicated subclass (vs. reusing `ServerError`):
 *   - The frontend `Step8SaveErrorBanner` discriminates by `error.code`
 *     to render a "Passcreator sync failed — please retry" CTA. Reusing
 *     `ServerError` would conflate this with genuine 500s (e.g. a DB
 *     outage) where retrying the same request is pointless.
 *   - The HTTP status is semantically different: 502 means "the upstream
 *     failed" (Passcreator is down or rejected the request), not "we
 *     failed" (DB bug, runtime crash). A 502 lets the client (and any
 *     monitoring) see this clearly.
 *   - The i18n key `passCreator.error.upstreamFailed` carries a different
 *     user-visible message than `common.error.internal`.
 *
 * Conventions:
 *   - `upstream` (string): a stable identifier for the upstream service
 *     (e.g. `'passcreator'`). Surfaced in `details.upstream` for
 *     observability dashboards.
 *   - `upstreamStatus` (number, optional): the HTTP status returned by
 *     the upstream, if any. Surfaced in `details.upstreamStatus` so the
 *     user-facing banner can include a "reason" line.
 *   - `upstreamBody` (string, optional): truncated response body (≤ 500
 *     chars) for debugging. NEVER include secrets / API keys here — the
 *     Passcreator service echoes 401 bodies that may contain the
 *     request path; redact anything sensitive upstream before passing
 *     to this constructor.
 *
 * @example
 *   throw new BadGatewayError({
 *     upstream: 'passcreator',
 *     upstreamStatus: 502,
 *     upstreamBody: 'Bad Gateway: upstream returned invalid JSON',
 *   });
 */
export class BadGatewayError extends SaomeError {
  constructor(args: {
    upstream: string;
    upstreamStatus?: number;
    upstreamBody?: string;
    i18nKey?: string;
    message?: string;
  }) {
    const body = args.upstreamBody;
    // Defense-in-depth: truncate to 500 chars to keep error envelopes
    // small. Upstream bodies can be arbitrary size.
    const safeBody =
      body && body.length > 500
        ? `${body.slice(0, 500)}... (truncated)`
        : body;
    super({
      status: 502,
      code: 'BAD_GATEWAY',
      i18nKey: args.i18nKey ?? 'common.error.upstreamFailed',
      message: args.message ?? `Upstream ${args.upstream} failed`,
      details: {
        upstream: args.upstream,
        upstreamStatus: args.upstreamStatus,
        upstreamBody: safeBody,
      },
    });
    this.name = 'BadGatewayError';
  }
}