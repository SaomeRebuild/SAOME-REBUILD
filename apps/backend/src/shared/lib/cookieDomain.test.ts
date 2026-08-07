/**
 * Unit tests for refreshCookieDomain helper.
 *
 * Verifies the cookie Domain attribute is emitted only for *.saome.org
 * production origins, never for workers.dev / pages.dev / localhost /
 * missing Origin headers. Per Bug-4 fix.
 *
 * Also covers refreshCookieSecure (Bug-7 fix): the `Secure` flag is emitted
 * only for HTTPS origins; HTTP dev origins drop it so the browser stores
 * the cookie.
 */

import { describe, it, expect } from 'vitest';
import { refreshCookieDomain, refreshCookieSecure, refreshCookieSameSite } from './cookieDomain';

describe('refreshCookieDomain', () => {
  it('emits Domain=.saome.org for app.saome.org', () => {
    expect(refreshCookieDomain('https://app.saome.org')).toBe(' Domain=.saome.org');
  });

  it('emits Domain=.saome.org for admin.saome.org', () => {
    expect(refreshCookieDomain('https://admin.saome.org')).toBe(' Domain=.saome.org');
  });

  it('emits Domain=.saome.org for apex saome.org', () => {
    expect(refreshCookieDomain('https://saome.org')).toBe(' Domain=.saome.org');
  });

  it('emits Domain=.saome.org case-insensitively', () => {
    expect(refreshCookieDomain('https://APP.SAOME.ORG')).toBe(' Domain=.saome.org');
  });

  it('emits empty string for workers.dev', () => {
    expect(refreshCookieDomain('https://saome-backend.josh1989213.workers.dev')).toBe('');
  });

  it('emits empty string for pages.dev', () => {
    expect(refreshCookieDomain('https://saome-frontend.pages.dev')).toBe('');
  });

  it('emits empty string for localhost', () => {
    expect(refreshCookieDomain('http://localhost:5173')).toBe('');
  });

  it('emits empty string for missing Origin', () => {
    expect(refreshCookieDomain(null)).toBe('');
    expect(refreshCookieDomain(undefined)).toBe('');
    expect(refreshCookieDomain('')).toBe('');
  });

  it('does NOT match lookalike domain saome.org.evil.com', () => {
    expect(refreshCookieDomain('https://saome.org.evil.com')).toBe('');
  });

  it('does NOT match lookalike domain evilsaome.org', () => {
    expect(refreshCookieDomain('https://evilsaome.org')).toBe('');
  });

  it('returns empty string on unparseable garbage', () => {
    expect(refreshCookieDomain('not-a-url')).toBe('');
    expect(refreshCookieDomain('http://')).toBe('');
  });
});

describe('refreshCookieSecure (Bug-7)', () => {
  it('emits "; Secure" for HTTPS production origin', () => {
    expect(refreshCookieSecure('https://app.saome.org')).toBe('; Secure');
    expect(refreshCookieSecure('https://saome-frontend.pages.dev')).toBe('; Secure');
    expect(refreshCookieSecure('https://saome-backend.josh1989213.workers.dev')).toBe('; Secure');
  });

  it('emits empty string for HTTP localhost dev origin', () => {
    expect(refreshCookieSecure('http://localhost:5173')).toBe('');
    expect(refreshCookieSecure('http://127.0.0.1:8787')).toBe('');
  });

  it('emits "; Secure" for missing origin (defaults to production)', () => {
    expect(refreshCookieSecure(null)).toBe('; Secure');
    expect(refreshCookieSecure(undefined)).toBe('; Secure');
    expect(refreshCookieSecure('')).toBe('; Secure');
  });

  it('emits "; Secure" for unparseable garbage (safe default)', () => {
    expect(refreshCookieSecure('not-a-url')).toBe('; Secure');
  });

  it('handles mixed case protocol', () => {
    expect(refreshCookieSecure('HTTPS://app.saome.org')).toBe('; Secure');
    expect(refreshCookieSecure('HTTP://localhost:5173')).toBe('');
  });
});

describe('refreshCookieSameSite (Bug-7 follow-up)', () => {
  it('emits "; SameSite=None" for HTTPS origin (cross-site safe)', () => {
    expect(refreshCookieSameSite('https://app.saome.org')).toBe('; SameSite=None');
    expect(refreshCookieSameSite('https://saome-frontend.pages.dev')).toBe('; SameSite=None');
  });

  it('emits "; SameSite=Lax" for HTTP origin', () => {
    expect(refreshCookieSameSite('http://localhost:5173')).toBe('; SameSite=Lax');
    expect(refreshCookieSameSite('http://127.0.0.1:8787')).toBe('; SameSite=Lax');
  });

  it('emits "; SameSite=None" for missing origin (production default)', () => {
    expect(refreshCookieSameSite(null)).toBe('; SameSite=None');
    expect(refreshCookieSameSite(undefined)).toBe('; SameSite=None');
  });

  it('handles unparseable garbage as production (None)', () => {
    expect(refreshCookieSameSite('not-a-url')).toBe('; SameSite=None');
  });
});