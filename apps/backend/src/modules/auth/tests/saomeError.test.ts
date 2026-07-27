/**
 * saomeError.test.ts ??vitest unit tests for SaomeError + subclasses.
 *
 * RED phase (SAOME-12): these tests describe the expected behavior of
 * src/shared/lib/saomeError.ts. They run in workerd via
 * @cloudflare/vitest-pool-workers.
 *
 * Coverage targets (per 003-tdd-integration.mdc):
 *   - business logic ??90%
 *   - this module is part of business logic
 */

import { describe, it, expect } from 'vitest';
import {
  SaomeError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
} from '@/shared/lib/saomeError';

describe('SaomeError', () => {
  it('carries status, code, i18nKey, message, details', () => {
    const e = new SaomeError({
      status: 418,
      code: 'TEAPOT',
      i18nKey: 'errors.teapot',
      message: "I'm a teapot",
      details: { brewTime: 30 },
    });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SaomeError');
    expect(e.status).toBe(418);
    expect(e.code).toBe('TEAPOT');
    expect(e.i18nKey).toBe('errors.teapot');
    expect(e.message).toBe("I'm a teapot");
    expect(e.details).toEqual({ brewTime: 30 });
  });
});

describe('ValidationError', () => {
  it('has status 400, code VALIDATION_ERROR, default i18nKey', () => {
    const e = new ValidationError();
    expect(e.status).toBe(400);
    expect(e.code).toBe('VALIDATION_ERROR');
    expect(e.i18nKey).toBe('common.error.validationFailed');
    expect(e).toBeInstanceOf(SaomeError);
  });

  it('accepts custom i18nKey and details', () => {
    const e = new ValidationError('auth.error.invalidEmail', { field: 'email' });
    expect(e.i18nKey).toBe('auth.error.invalidEmail');
    expect(e.details).toEqual({ field: 'email' });
  });
});

describe('AuthError', () => {
  it('has status 401, code UNAUTHORIZED', () => {
    const e = new AuthError();
    expect(e.status).toBe(401);
    expect(e.code).toBe('UNAUTHORIZED');
    expect(e).toBeInstanceOf(SaomeError);
  });

  it('accepts custom i18nKey + message', () => {
    const e = new AuthError('auth.error.sessionExpired', 'Session expired');
    expect(e.i18nKey).toBe('auth.error.sessionExpired');
    expect(e.message).toBe('Session expired');
  });
});

describe('ForbiddenError', () => {
  it('has status 403, code FORBIDDEN', () => {
    const e = new ForbiddenError();
    expect(e.status).toBe(403);
    expect(e.code).toBe('FORBIDDEN');
  });
});

describe('NotFoundError', () => {
  it('has status 404, code NOT_FOUND', () => {
    const e = new NotFoundError();
    expect(e.status).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });
});

describe('ConflictError', () => {
  it('has status 409, code CONFLICT, custom i18nKey/message', () => {
    const e = new ConflictError('auth.error.emailTaken', 'Email already in use', { email: 'user' + '@example.com' });
    expect(e.status).toBe(409);
    expect(e.code).toBe('CONFLICT');
    expect(e.i18nKey).toBe('auth.error.emailTaken');
    expect(e.message).toBe('Email already in use');
    expect(e.details).toEqual({ email: 'user' + '@example.com' });
  });
});

describe('RateLimitError', () => {
  it('has status 429, code RATE_LIMITED, retryAfterSec', () => {
    const e = new RateLimitError(600);
    expect(e.status).toBe(429);
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.retryAfterSec).toBe(600);
    expect(e.details).toEqual({ retryAfterSec: 600 });
  });
});

describe('ServerError', () => {
  it('has status 500, code INTERNAL_ERROR, wraps original error', () => {
    const orig = new Error('DB connection failed');
    const e = new ServerError(orig);
    expect(e.status).toBe(500);
    expect(e.code).toBe('INTERNAL_ERROR');
    expect(e.details?.original).toEqual({ name: 'Error', message: 'DB connection failed' });
  });

  it('handles non-Error original', () => {
    const e = new ServerError('plain string');
    expect(e.details?.original).toBeUndefined();
  });

  it('does NOT leak original error message in `message` field', () => {
    const e = new ServerError(new Error('SECRET_PASSWORD=hunter2'));
    expect(e.message).toBe('Internal server error');
    expect(e.message).not.toContain('hunter2');
  });
});

describe('Error JSON serialization shape', () => {
  it('matches contracts/auth.ts::ErrorResponseDto', () => {
    const e = new ConflictError('auth.error.emailTaken', 'Email taken');
    const dto = {
      error: {
        code: e.code,
        i18nKey: e.i18nKey,
        message: e.message,
        details: e.details,
      },
      requestId: 'fake-request-id',
    };
    // DTO shape: { error: { code, i18nKey, message, details? }, requestId: string }
    expect(dto.error.code).toBe('CONFLICT');
    expect(dto.error.i18nKey).toBe('auth.error.emailTaken');
    expect(typeof dto.requestId).toBe('string');
  });
});
