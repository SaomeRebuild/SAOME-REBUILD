/**
 * Step7TableCard — i18n namespace completeness test (2026-09-27).
 *
 * Verifies:
 *   - flat key structure (Rule 023)
 *   - zh-TW / en key sets match (sync check)
 *   - 5 exportButton states are present in both locales
 *   - zh-TW doesn't mix English words (Rule 023 § 翻譯書寫紀律)
 *
 * Run: `npm test -- Step7TableCard.i18n.test`
 */

import { describe, expect, it } from 'vitest';
import tableCardZhTW from '@/i18n/locales/tableCard.zh-TW';
import tableCardEn from '@/i18n/locales/tableCard.en';

/** Flatten a nested object into dot-separated keys. */
function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe('tableCard i18n namespace', () => {
  it('zh-TW has flat key structure (Rule 023)', () => {
    const keys = flatKeys(tableCardZhTW as Record<string, unknown>);
    // Page-level keys
    expect(keys).toContain('pageTitle');
    // Tool keys
    expect(keys).toContain('tools.text');
    expect(keys).toContain('tools.image');
    expect(keys).toContain('tools.background');
    expect(keys).toContain('tools.shape');
    expect(keys).toContain('tools.layers');
    // Round 4 — Issue 1: selectionBar.elementNumber for the
    // creation-order number suffix on the SelectionBar.
    expect(keys).toContain('selectionBar.elementNumber');
    // Round 6 — text tool line-break support (Inspector textarea).
    expect(keys).toContain('text.lineBreakHint');
    // Round 6 — image shape transformation (rect / circle / triangle).
    expect(keys).toContain('image.shapeLabel');
    expect(keys).toContain('image.shapeRect');
    expect(keys).toContain('image.shapeCircle');
    expect(keys).toContain('image.shapeTriangle');
    expect(keys).toContain('image.clipRadius');
    expect(keys).toContain('image.clipRadiusUnit');
    // Export button states (5)
    expect(keys).toContain('exportButton.idle');
    expect(keys).toContain('exportButton.generating');
    expect(keys).toContain('exportButton.ready');
    expect(keys).toContain('exportButton.stale');
    expect(keys).toContain('exportButton.error');
    // Error keys (4)
    expect(keys).toContain('errors.networkError');
    expect(keys).toContain('errors.serverError');
    expect(keys).toContain('errors.blobError');
    expect(keys).toContain('errors.validationError');
  });

  it('zh-TW and en have matching key sets (sync check)', () => {
    const zh = flatKeys(tableCardZhTW as Record<string, unknown>);
    const en = flatKeys(tableCardEn as Record<string, unknown>);
    expect(en.sort()).toEqual(zh.sort());
  });

  it('zh-TW exportButton has 5 distinct states with distinct copy', () => {
    const eb = (tableCardZhTW as Record<string, unknown>).exportButton as Record<string, string>;
    expect(eb.idle).toBeTruthy();
    expect(eb.generating).toBeTruthy();
    expect(eb.ready).toBeTruthy();
    expect(eb.stale).toBeTruthy();
    expect(eb.error).toBeTruthy();
    // Each state's copy is unique (not deduped)
    const states = new Set([eb.idle, eb.generating, eb.ready, eb.stale, eb.error]);
    expect(states.size).toBe(5);
  });

  it('zh-TW does not mix English words (Rule 023 § 翻譯書寫紀律)', () => {
    // Walk the tree and check only string LEAF values (not keys).
    function leafValues(obj: Record<string, unknown>): string[] {
      return Object.values(obj).flatMap((v) =>
        typeof v === 'string'
          ? [v]
          : v && typeof v === 'object' && !Array.isArray(v)
            ? leafValues(v as Record<string, unknown>)
            : [],
      );
    }
    const allValues = leafValues(tableCardZhTW as Record<string, unknown>).join('\n');
    // Disallow standalone English content words. ASCII punctuation /
    // numbers are allowed (e.g. "5MB", "200 字").
    // Lookbehind + lookahead use word boundaries; case-insensitive.
    const forbidden = /\b(Canvas|Layer|Element|Background|Image|Stage|Tool|Inspector)\b/i;
    // 'Text' appears as a value in 'maxLength' / 'counter' template strings? No,
    // we use Chinese 文字 throughout. But user-facing 'Text' would be a violation.
    const textForbidden = /\bText\b/;
    expect(forbidden.test(allValues)).toBe(false);
    expect(textForbidden.test(allValues)).toBe(false);
  });

  it('en is fully English (Rule 023)', () => {
    const json = JSON.stringify(tableCardEn);
    // Disallow CJK characters in English file
    expect(json).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it('zh-TW page-level key pageTitle is present and non-empty', () => {
    expect((tableCardZhTW as Record<string, unknown>).pageTitle).toBeTruthy();
    expect((tableCardEn as Record<string, unknown>).pageTitle).toBeTruthy();
  });
});
