/**
 * Tests for shared/middleware/cors.
 *
 * Critical: this is the only line of defense against CORS preflight failures
 * that present as "I can't log in, but DB shows zero attempts". Bug-4d:
 * the production CORS allowlist did not include the Workers preview URL
 * `https://saome-frontend.josh1989213.workers.dev`, so the browser silently
 * dropped the login POST and recorded only the OPTIONS preflight.
 *
 * These tests assert:
 *  - exact origin match → echoed back
 *  - host wildcard pattern match → echoed back (NEW for Bug-4d)
 *  - unrelated origin → undefined (blocked)
 *  - malformed origin → undefined (fail closed)
 */

import { describe, it, expect } from 'vitest';
import { matchHostPattern, resolveAllowedOrigin } from './cors';

describe('matchHostPattern', () => {
  it('matches exact host', () => {
    expect(matchHostPattern('saome.org', 'saome.org')).toBe(true);
  });

  it('does not match a different apex', () => {
    expect(matchHostPattern('example.com', 'saome.org')).toBe(false);
  });

  it('*.foo.com matches any single subdomain', () => {
    expect(matchHostPattern('a.foo.com', '*.foo.com')).toBe(true);
  });

  it('*.foo.com matches deep subdomain', () => {
    expect(matchHostPattern('a.b.foo.com', '*.foo.com')).toBe(true);
  });

  it('*.foo.com does NOT match the apex foo.com', () => {
    expect(matchHostPattern('foo.com', '*.foo.com')).toBe(false);
  });

  it('case-insensitive', () => {
    expect(matchHostPattern('Saome.ORG', 'saome.org')).toBe(true);
    expect(matchHostPattern('A.Saome.Org', '*.saome.org')).toBe(true);
  });
});

describe('resolveAllowedOrigin', () => {
  const baseEnv = {
    ALLOWED_ORIGINS:
      'https://saome-frontend.pages.dev,https://saome-admin.pages.dev',
    ALLOWED_ORIGIN_PATTERNS:
      '*.josh1989213.workers.dev,*.saome.org,*.saome-frontend.pages.dev',
  } as Parameters<typeof resolveAllowedOrigin>[1];

  it('returns the origin when an exact match exists in ALLOWED_ORIGINS', () => {
    expect(
      resolveAllowedOrigin('https://saome-frontend.pages.dev', baseEnv),
    ).toBe('https://saome-frontend.pages.dev');
  });

  it('returns the origin for a Workers preview via host pattern', () => {
    expect(
      resolveAllowedOrigin(
        'https://saome-frontend.josh1989213.workers.dev',
        baseEnv,
      ),
    ).toBe('https://saome-frontend.josh1989213.workers.dev');
  });

  it('returns the origin for an app.saome.org subdomain via pattern', () => {
    expect(resolveAllowedOrigin('https://app.saome.org', baseEnv)).toBe(
      'https://app.saome.org',
    );
  });

  it('returns undefined for an unrelated host', () => {
    expect(resolveAllowedOrigin('https://evil.example.com', baseEnv)).toBeUndefined();
  });

  it('returns undefined for an empty origin', () => {
    expect(resolveAllowedOrigin(undefined, baseEnv)).toBeUndefined();
  });

  it('returns undefined for an unparseable origin', () => {
    expect(resolveAllowedOrigin('not-a-url', baseEnv)).toBeUndefined();
  });

  it('returns undefined for the bare apex when only *.foo.com is allowed', () => {
    expect(resolveAllowedOrigin('https://josh1989213.workers.dev', baseEnv)).toBeUndefined();
  });
});