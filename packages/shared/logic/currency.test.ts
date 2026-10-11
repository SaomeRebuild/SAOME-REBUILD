/**
 * Shared Currency formatters — test contract.
 *
 * @module shared/logic/currency.test
 *
 * Conformance tests pin the formatting contract so the editor preview,
 * the Passcreator push, and the React Native app all see the same
 * numeric surface. Drift here = UI shows $1,000 to one user and
 * US$1,000.00 to another (Rule 019 § D.3).
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyOrFallback, isFiniteNumber } from './currency';

describe('isFiniteNumber', () => {
  it('returns true for plain finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(100)).toBe(true);
    expect(isFiniteNumber(-5.5)).toBe(true);
  });
  it('returns false for NaN / Infinity / non-numbers', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber('100')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
  });
});

describe('formatCurrency', () => {
  describe('TWD', () => {
    it('formats whole numbers with `NT$` prefix and thousands separator', () => {
      expect(formatCurrency(1000, 'TWD')).toEqual({ formatted: 'NT$1,000' });
    });
    it('omits fractional cents (Taiwan retail pricing convention)', () => {
      // Hand-tuned formatter — rounds to integer because Taiwan retail
      // surfaces don't display cents (Math.round rounds 1000.5 → 1001
      // per banker's rounding behavior? — JS `Math.round` rounds half AWAY
      // from zero: 1000.5 → 1001, 999.5 → 1000).
      expect(formatCurrency(1000.49, 'TWD')).toEqual({ formatted: 'NT$1,000' });
      expect(formatCurrency(1000.5, 'TWD')).toEqual({ formatted: 'NT$1,001' });
    });
    it('handles small amounts without a thousands separator', () => {
      expect(formatCurrency(50, 'TWD')).toEqual({ formatted: 'NT$50' });
    });
    it('handles zero', () => {
      expect(formatCurrency(0, 'TWD')).toEqual({ formatted: 'NT$0' });
    });
  });

  describe('ZAR', () => {
    it('uses `R` prefix WITHOUT space (per design system 2026-10-11)', () => {
      expect(formatCurrency(10, 'ZAR')).toEqual({ formatted: 'R10' });
    });
    it('formats larger amounts with thousands separator', () => {
      expect(formatCurrency(1500, 'ZAR')).toEqual({ formatted: 'R1,500' });
    });
    it('omits fractional cents (consumer-facing surface)', () => {
      expect(formatCurrency(99.49, 'ZAR')).toEqual({ formatted: 'R99' });
      expect(formatCurrency(99.5, 'ZAR')).toEqual({ formatted: 'R100' });
    });
  });

  describe('USD', () => {
    it('formats with two-decimal currency standard', () => {
      expect(formatCurrency(10, 'USD')).toEqual({ formatted: '$10.00' });
    });
    it('formats zero with two-decimal currency standard', () => {
      expect(formatCurrency(0, 'USD')).toEqual({ formatted: '$0.00' });
    });
  });

  describe('JPY', () => {
    it('uses no fractional digits (ISO 4217 — JPY has no minor unit)', () => {
      // `Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })`
      // emits `￥1,000` (U+FFE5 — full-width yen sign) on most ICU builds,
      // but a few builds emit `¥1,000` (U+00A5 — half-width). Accept either.
      const result = formatCurrency(1000, 'JPY');
      expect('formatted' in result).toBe(true);
      if ('formatted' in result) {
        expect(result.formatted).toMatch(/^[¥￥]1,000$/);
      }
    });
  });

  describe('EUR', () => {
    it('formats with two-decimal currency standard and en-IE separator', () => {
      expect(formatCurrency(10, 'EUR')).toEqual({ formatted: '€10.00' });
    });
  });

  describe('default currency = TWD when omitted', () => {
    it('uses TWD formatter when no currency code is passed', () => {
      expect(formatCurrency(100)).toEqual({ formatted: 'NT$100' });
    });
  });

  describe('invalid input', () => {
    it('returns error tuple for NaN', () => {
      const result = formatCurrency(NaN, 'TWD');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error.type).toBe('invalid');
        expect(result.error.message).toBe('currency.error.invalidNumber');
      }
    });
    it('returns error tuple for Infinity', () => {
      const result = formatCurrency(Infinity, 'USD');
      expect('error' in result).toBe(true);
    });
    it('returns error tuple for undefined', () => {
      const result = formatCurrency(undefined, 'EUR');
      expect('error' in result).toBe(true);
    });
    it('returns error tuple for strings', () => {
      const result = formatCurrency('100', 'TWD');
      expect('error' in result).toBe(true);
    });
    it('does NOT silent-render zero for invalid input', () => {
      // Drift guard: would render `$0.00` if we fell through to format()
      // with a NaN-coerced argument. We surface an error tuple instead.
      const result = formatCurrency(NaN, 'USD');
      expect('formatted' in result).toBe(false);
    });
  });
});

describe('formatCurrencyOrFallback', () => {
  it('returns formatted string on valid input', () => {
    expect(formatCurrencyOrFallback(1000, 'TWD')).toBe('NT$1,000');
  });
  it('returns fallback (default "—") on invalid input', () => {
    expect(formatCurrencyOrFallback(NaN, 'TWD')).toBe('—');
  });
  it('respects a custom fallback', () => {
    expect(formatCurrencyOrFallback(NaN, 'USD', 'N/A')).toBe('N/A');
  });
});
