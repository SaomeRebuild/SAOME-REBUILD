/**
 * color.ts — Vitest tests
 *
 * Covers: normalizeHex (5 cases), validateColor (3 cases), isPresetColor (3 cases).
 */

import { describe, it, expect } from 'vitest';
import { normalizeHex, validateColor, isPresetColor } from './color';

describe('normalizeHex', () => {
  it('uppercases lowercase 6-char hex', () => {
    expect(normalizeHex('ffffff')).toBe('FFFFFF');
  });

  it('strips leading # prefix', () => {
    expect(normalizeHex('#FFFFFF')).toBe('FFFFFF');
  });

  it('trims surrounding whitespace and uppercases', () => {
    expect(normalizeHex('  #1a1a1a  ')).toBe('1A1A1A');
  });

  it('returns null for 3-digit shorthand (rejected — strict 6-char only)', () => {
    expect(normalizeHex('FFF')).toBeNull();
  });

  it('returns null for invalid hex characters', () => {
    expect(normalizeHex('GGGGGG')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeHex('')).toBeNull();
  });

  it('returns null for 7+ char input (rejected)', () => {
    expect(normalizeHex('FFFFFFF')).toBeNull();
  });
});

describe('validateColor', () => {
  it('returns { hex } on valid input', () => {
    const result = validateColor('ff0000');
    expect('hex' in result).toBe(true);
    if ('hex' in result) expect(result.hex).toBe('FF0000');
  });

  it('returns ColorValidationError with i18n key on invalid input', () => {
    const result = validateColor('xyz');
    expect('hex' in result).toBe(false);
    if (!('hex' in result)) {
      expect(result.type).toBe('invalid');
      expect(result.message).toBe('colorPicker.validation.invalid');
    }
  });

  it('accepts # prefix in validation', () => {
    const result = validateColor('#22C55E');
    expect('hex' in result).toBe(true);
    if ('hex' in result) expect(result.hex).toBe('22C55E');
  });
});

describe('isPresetColor', () => {
  it('returns true for a preset color (uppercase, no #)', () => {
    expect(isPresetColor('F97316')).toBe(true);
  });

  it('normalizes input before matching (lowercase + # prefix)', () => {
    expect(isPresetColor('#f97316')).toBe(true);
  });

  it('returns false for a non-preset color', () => {
    expect(isPresetColor('123456')).toBe(false);
  });

  it('returns false for invalid input', () => {
    expect(isPresetColor('xyz')).toBe(false);
  });
});
