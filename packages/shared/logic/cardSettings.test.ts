/**
 * unwrapCardSettings — defensive parser for templates.settings JSONB.
 *
 * @see packages/shared/logic/cardSettings.ts
 *
 * Tests the 5 corruption cases from Bug #8.5 (2026-08-31) and the normal-case
 * passthrough. Behavior MUST match the backend cardService.ts version exactly —
 * see packages/shared/logic/cardSettings.ts for the contract.
 */

import { describe, it, expect } from 'vitest';
import { unwrapCardSettings } from './cardSettings';

describe('unwrapCardSettings — Bug #8.5 defensive unwrap contract', () => {
  it('returns {} for null', () => {
    expect(unwrapCardSettings(null)).toEqual({});
  });

  it('returns {} for undefined', () => {
    expect(unwrapCardSettings(undefined)).toEqual({});
  });

  it('returns {} for non-object non-array primitives (number / boolean)', () => {
    expect(unwrapCardSettings(42)).toEqual({});
    expect(unwrapCardSettings(true)).toEqual({});
  });

  it('passes through a normal object unchanged', () => {
    const settings = { description: 'hi', backFields: [{ label: 'a', value: 'b' }] };
    expect(unwrapCardSettings(settings)).toEqual(settings);
  });

  it('parses a JSON string into an object (legacy corruption case 1)', () => {
    const raw = JSON.stringify({ description: 'hi', foo: 1 });
    expect(unwrapCardSettings(raw)).toEqual({ description: 'hi', foo: 1 });
  });

  it('returns {} for a malformed JSON string (parse failure)', () => {
    expect(unwrapCardSettings('{not json')).toEqual({});
  });

  it('reduce-merges an array of objects (Bug #8 partial fix case)', () => {
    const raw = [
      { description: 'first', foo: 1 },
      { description: 'second', bar: 2 },
    ];
    expect(unwrapCardSettings(raw)).toEqual({
      description: 'second', // later wins
      foo: 1,
      bar: 2,
    });
  });

  it('reduce-merges an array of JSON strings (Bug #8.5 worst case)', () => {
    const raw = [
      JSON.stringify({ description: 'first', foo: 1 }),
      JSON.stringify({ description: 'second', bar: 2 }),
    ];
    expect(unwrapCardSettings(raw)).toEqual({
      description: 'second',
      foo: 1,
      bar: 2,
    });
  });

  it('handles mixed array (objects + strings + nested arrays)', () => {
    const raw = [
      { a: 1 },
      JSON.stringify({ b: 2 }),
      [{ c: 3 }, { d: 4 }], // nested array
    ];
    expect(unwrapCardSettings(raw)).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });

  it('always returns a plain object (never null/undefined/array)', () => {
    const result = unwrapCardSettings([1, 2, 3]);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(false);
    expect(typeof result).toBe('object');
  });
});