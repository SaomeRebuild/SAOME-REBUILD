/**
 * Unit tests for refreshCookieDomain helper.
 *
 * Verifies the cookie Domain attribute is emitted only for *.saome.org
 * production origins, never for workers.dev / pages.dev / localhost /
 * missing Origin headers. Per Bug-4 fix.
 */

import { describe, it, expect } from 'vitest';
import { refreshCookieDomain } from './cookieDomain';

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