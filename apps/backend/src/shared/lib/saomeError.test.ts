/**
 * Unit tests for shared/lib/saomeError — adds coverage for the
 * `BadGatewayError` subclass (added 2026-10-11 alongside the
 * Passcreator integration).
 *
 * @module shared/lib/saomeError.test
 *
 * Conformance tests pin the error envelope shape so the errorHandler
 * middleware can render a stable response, and the frontend
 * `Step8SaveErrorBanner` can discriminate by `error.code === 'BAD_GATEWAY'`.
 *
 * Rule references:
 *   - Rule 019 § D.3 — error envelopes are a contract; this file
 *     pins the shape that the frontend banner depends on.
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
  BadGatewayError,
} from './saomeError';

describe('SaomeError base', () => {
  it('preserves status / code / i18nKey / details', () => {
    const err = new SaomeError({
      status: 418,
      code: 'TEAPOT',
      i18nKey: 'common.error.teapot',
      message: 'I am a teapot',
      details: { reason: 'coffee shop down' },
    });
    expect(err.status).toBe(418);
    expect(err.code).toBe('TEAPOT');
    expect(err.i18nKey).toBe('common.error.teapot');
    expect(err.details).toEqual({ reason: 'coffee shop down' });
    expect(err.message).toBe('I am a teapot');
  });
});

describe('SaomeError subclasses', () => {
  it('ValidationError uses 400', () => {
    expect(new ValidationError().status).toBe(400);
  });
  it('AuthError uses 401', () => {
    expect(new AuthError().status).toBe(401);
  });
  it('ForbiddenError uses 403', () => {
    expect(new ForbiddenError().status).toBe(403);
  });
  it('NotFoundError uses 404', () => {
    expect(new NotFoundError().status).toBe(404);
  });
  it('ConflictError uses 409', () => {
    expect(new ConflictError('common.error.duplicate', 'dup').status).toBe(409);
  });
  it('RateLimitError uses 429 and exposes retryAfterSec', () => {
    const r = new RateLimitError(30);
    expect(r.status).toBe(429);
    expect(r.retryAfterSec).toBe(30);
    expect(r.details?.retryAfterSec).toBe(30);
  });
  it('ServerError uses 500 and wraps the original error', () => {
    const inner = new Error('postgres down');
    const outer = new ServerError(inner);
    expect(outer.status).toBe(500);
    expect(outer.details?.original).toEqual({
      name: 'Error',
      message: 'postgres down',
    });
  });
});

describe('BadGatewayError (added 2026-10-11, Passcreator integration)', () => {
  it('uses status=502 / code=BAD_GATEWAY', () => {
    const err = new BadGatewayError({ upstream: 'passcreator' });
    expect(err.status).toBe(502);
    expect(err.code).toBe('BAD_GATEWAY');
    expect(err.name).toBe('BadGatewayError');
    expect(err).toBeInstanceOf(SaomeError);
  });
  it('propagates upstream, upstreamStatus, upstreamBody to details', () => {
    const err = new BadGatewayError({
      upstream: 'passcreator',
      upstreamStatus: 503,
      upstreamBody: 'Service Unavailable',
    });
    expect(err.details?.upstream).toBe('passcreator');
    expect(err.details?.upstreamStatus).toBe(503);
    expect(err.details?.upstreamBody).toBe('Service Unavailable');
  });
  it('default i18n key is common.error.upstreamFailed', () => {
    const err = new BadGatewayError({ upstream: 'passcreator' });
    expect(err.i18nKey).toBe('common.error.upstreamFailed');
  });
  it('allows overriding the i18n key (per-upstream localization)', () => {
    const err = new BadGatewayError({
      upstream: 'passcreator',
      i18nKey: 'passCreator.error.upstreamFailed',
    });
    expect(err.i18nKey).toBe('passCreator.error.upstreamFailed');
  });
  it('truncates a long upstream body to ≤ 500 chars + suffix', () => {
    // Construct a body directly — bypasses the network so we test the
    // BadGatewayError contract in isolation.
    const body = 'X'.repeat(2000);
    const err = new BadGatewayError({ upstream: 'passcreator', upstreamBody: body });
    const stored = String(err.details?.upstreamBody ?? '');
    // Total = 500 (slice) + 15 ('... (truncated)' is 15 chars: '.', '.', '.', ' ', '(', 't', 'r', 'u', 'n', 'c', 'a', 't', 'e', 'd', ')')
    expect(stored.length).toBe(515);
    expect(stored.endsWith('... (truncated)')).toBe(true);
  });
  it('preserves a short upstream body intact', () => {
    const err = new BadGatewayError({ upstream: 'passcreator', upstreamBody: 'small' });
    expect(err.details?.upstreamBody).toBe('small');
  });
  it('default message includes the upstream identifier', () => {
    const err = new BadGatewayError({ upstream: 'passcreator' });
    expect(err.message.toLowerCase()).toContain('passcreator');
  });
});
