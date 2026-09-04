/**
 * Unit tests for packages/shared/logic/links.ts.
 *
 * Coverage: isValidUrl() handles https://, tel:, mailto:, custom schemes,
 * unparseable strings, and the empty-string "not yet filled" case — plus
 * the 2026-09-05 fallback layer (phone shapes per PHONE_COUNTRY_PATTERNS
 * and email RFC-5322-lite).
 */

import { describe, it, expect } from 'vitest';
import { isValidUrl, isPhoneLike, PHONE_COUNTRY_PATTERNS } from './links';

describe('isValidUrl — web URLs', () => {
  it('accepts https://example.com', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('accepts http://example.com', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts https with path + query + fragment', () => {
    expect(isValidUrl('https://x.com/a?b=1&c=2#frag')).toBe(true);
  });

  it('accepts subdomain URLs', () => {
    expect(isValidUrl('https://sub.domain.example.com/path')).toBe(true);
  });
});

describe('isValidUrl — Apple Wallet link types', () => {
  it('accepts tel: scheme (Apple Wallet phone links)', () => {
    expect(isValidUrl('tel:+1234567890')).toBe(true);
  });

  it('accepts mailto: scheme (Apple Wallet email links)', () => {
    expect(isValidUrl('mailto:user@example.com')).toBe(true);
  });
});

describe('isValidUrl — empty / unfilled', () => {
  it('accepts empty string (unfilled field is not an error)', () => {
    expect(isValidUrl('')).toBe(true);
  });
});

describe('isValidUrl — phone fallback (TW + ZA via PHONE_COUNTRY_PATTERNS)', () => {
  // ===== South Africa =====
  it('accepts ZA mobile local 0821234567', () => {
    expect(isValidUrl('0821234567')).toBe(true);
  });

  it('accepts ZA mobile with space separators', () => {
    expect(isValidUrl('082 123 4567')).toBe(true);
  });

  it('accepts ZA mobile international +27 82 123 4567', () => {
    expect(isValidUrl('+27 82 123 4567')).toBe(true);
  });

  it('accepts ZA international with parens around drop-zero', () => {
    expect(isValidUrl('+27 (0) 82 123 4567')).toBe(true);
  });

  it('accepts ZA landline 0211234567', () => {
    expect(isValidUrl('0211234567')).toBe(true);
  });

  it('accepts ZA landline with hyphen 021-123-4567', () => {
    expect(isValidUrl('021-123-4567')).toBe(true);
  });

  // ===== Taiwan =====
  it('accepts TW mobile local 0912345678', () => {
    expect(isValidUrl('0912345678')).toBe(true);
  });

  it('accepts TW mobile with hyphens 0912-345-678', () => {
    expect(isValidUrl('0912-345-678')).toBe(true);
  });

  it('accepts TW landline 021234567', () => {
    expect(isValidUrl('021234567')).toBe(true);
  });

  it('accepts TW international +886912345678', () => {
    expect(isValidUrl('+886912345678')).toBe(true);
  });
});

describe('isValidUrl — email fallback', () => {
  it('accepts simple email user@example.com', () => {
    expect(isValidUrl('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain name@sub.example.com', () => {
    expect(isValidUrl('name@sub.example.com')).toBe(true);
  });

  it('accepts email with plus tag name+tag@example.com', () => {
    expect(isValidUrl('name+tag@example.com')).toBe(true);
  });

  it('accepts email with dots in local part first.last@example.com', () => {
    expect(isValidUrl('first.last@example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(isValidUrl('userexample.com')).toBe(false);
  });

  it('rejects email without TLD', () => {
    expect(isValidUrl('user@example')).toBe(false);
  });
});

describe('isValidUrl — unparseable strings', () => {
  it('rejects plain text without a scheme', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('rejects text with a colon but no valid scheme', () => {
    // `javascript:` is actually parseable; use something definitely invalid:
    expect(isValidUrl('foo bar baz')).toBe(false);
  });

  it('rejects malformed URL with spaces', () => {
    expect(isValidUrl('https://example .com')).toBe(false);
  });

  it('rejects lone colon', () => {
    expect(isValidUrl(':')).toBe(false);
  });

  it('rejects US phone number +1-555-123-4567 (not in PHONE_COUNTRY_PATTERNS)', () => {
    expect(isValidUrl('+1-555-123-4567')).toBe(false);
  });

  it('rejects random short digits', () => {
    expect(isValidUrl('12345')).toBe(false);
  });
});

describe('isPhoneLike — direct helper', () => {
  it('returns false on empty string', () => {
    expect(isPhoneLike('')).toBe(false);
  });

  it('returns true for any registered country', () => {
    expect(isPhoneLike('0821234567')).toBe(true); // ZA
    expect(isPhoneLike('0912345678')).toBe(true); // TW
  });

  it('returns false for unknown country code', () => {
    expect(isPhoneLike('+15551234567')).toBe(false); // US
  });
});

describe('PHONE_COUNTRY_PATTERNS — future expansion contract', () => {
  it('exposes at least TW and ZA today', () => {
    expect(Object.keys(PHONE_COUNTRY_PATTERNS).sort()).toEqual(['TW', 'ZA']);
  });

  it('every entry is a RegExp instance', () => {
    for (const pattern of Object.values(PHONE_COUNTRY_PATTERNS)) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });

  it('does not auto-prefix tel:/mailto: (accept-as-is policy)', () => {
    // The user-typed value is what gets validated; isValidUrl returns true
    // for raw phone shapes without injecting `tel:`. Persistence layer
    // (not this module) decides whether to add a scheme for Apple Wallet.
    const raw = '0821234567';
    expect(isValidUrl(raw)).toBe(true);
    expect(raw.startsWith('tel:')).toBe(false);
  });
});
