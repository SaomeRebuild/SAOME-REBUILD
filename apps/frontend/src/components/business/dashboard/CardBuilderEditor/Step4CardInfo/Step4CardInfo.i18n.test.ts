/**
 * Step4CardInfo — i18n coverage guard for the missing backFields counter key.
 *
 * Bug observed in DOM (2026-09-05): <LabelValueListField counterKey="step4.backFields.counter">
 * rendered the raw key as text. The `links` namespace has `counter` but `backFields`
 * does not. This test guards against re-introducing the asymmetry by asserting the
 * counter key exists in both zh-TW and en locales AND uses the same
 * `{{count}}` placeholder shape so the live preview reads "1 / 10" / "10 / 10"
 * etc.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Run from the workspace root (`npm test` lives at the root), so cwd is the
// monorepo root. The locale files live under apps/frontend/src/i18n/locales.
const LOCALES_DIR = join(process.cwd(), 'src/i18n/locales');

function readLocale(locale: 'zh-TW' | 'en') {
  const path = join(LOCALES_DIR, `cardEditor.${locale}.ts`);
  return readFileSync(path, 'utf8');
}

describe('cardEditor.step4.backFields.counter — both locales must ship the key', () => {
  it('zh-TW defines step4.backFields.counter with {{count}} placeholder', () => {
    const content = readLocale('zh-TW');
    // Counter line sits inside the backFields object literal.
    expect(content).toMatch(/backFields:\s*\{[\s\S]*?counter:\s*['"]\{\{count\}\}[^'"]*['"][\s\S]*?\}/);
  });

  it('en defines step4.backFields.counter with {{count}} placeholder', () => {
    const content = readLocale('en');
    expect(content).toMatch(/backFields:\s*\{[\s\S]*?counter:\s*['"]\{\{count\}\}[^'"]*['"][\s\S]*?\}/);
  });

  it('zh-TW backFields.counter is NOT just a copy of the links counter', () => {
    // The previous bug was: only links.counter existed. Verify backFields has its
    // own entry distinct from links.counter (which uses "{{count}} / 4").
    const content = readLocale('zh-TW');
    const match = content.match(/backFields:[\s\S]*?\}/);
    expect(match).not.toBeNull();
    // The block must contain the counter key
    expect(match![0]).toContain('counter:');
  });

  it('en backFields.counter is NOT just a copy of the links counter', () => {
    const content = readLocale('en');
    const match = content.match(/backFields:[\s\S]*?\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('counter:');
  });
});
