/**
 * Visit count formatting — test contract.
 *
 * @module shared/logic/visitCount.test
 *
 * Pins the "number + unit" contract for the `visitCount` face slot:
 *
 *   - zh-TW → `5 次`
 *   - en    → `5 times`
 *
 * The unit follows the TEMPLATE's language, not the reader's locale —
 * the same rule the discount tier slots follow (see
 * `logic/spendTier.test.ts`). A card authored in English shows
 * `5 times` even for a Traditional Chinese tenant, because the card's
 * audience is fixed by the template.
 *
 * A non-finite count renders as `—` (the same placeholder the tier
 * formatter uses) rather than `NaN 次`.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure function, no I/O.
 *   - Rule 024 § Mobile Future-Proof — no platform API used.
 */

import { describe, it, expect } from 'vitest';
import { formatVisitCount } from './visitCount';

describe('formatVisitCount', () => {
  it('renders a zh-TW count with the 次 unit', () => {
    expect(formatVisitCount(5, 'zh-TW')).toBe('5 次');
  });

  it('renders an English count with the "times" unit', () => {
    expect(formatVisitCount(5, 'en')).toBe('5 times');
  });

  it('renders a zero count with the unit (an unvisited card is still a card)', () => {
    expect(formatVisitCount(0, 'zh-TW')).toBe('0 次');
    expect(formatVisitCount(0, 'en')).toBe('0 times');
  });

  it('renders a multi-digit count without thousands separators', () => {
    expect(formatVisitCount(1234, 'zh-TW')).toBe('1234 次');
    expect(formatVisitCount(1234, 'en')).toBe('1234 times');
  });

  it('renders a non-finite count as the em-dash placeholder', () => {
    expect(formatVisitCount(Number.NaN, 'zh-TW')).toBe('—');
    expect(formatVisitCount(Number.NaN, 'en')).toBe('—');
    expect(formatVisitCount(Number.POSITIVE_INFINITY, 'zh-TW')).toBe('—');
    expect(formatVisitCount(Number.NEGATIVE_INFINITY, 'en')).toBe('—');
  });

  it('keeps a negative count visible (the metric schema forbids it, but the formatter must not hide it)', () => {
    expect(formatVisitCount(-1, 'zh-TW')).toBe('-1 次');
  });
});
