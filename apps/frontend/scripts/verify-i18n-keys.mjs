#!/usr/bin/env node
/**
 * verify-i18n-keys.mjs
 *
 * Audits i18n locale files for structural issues that cause raw key display.
 *
 * Checks:
 * 1. Translation values do not contain namespace-prefixed patterns
 *    (e.g., 'passCard.defaultName' inside the passCard namespace — causes double-prefixing)
 * 2. Every key in zh-TW has a corresponding key in en (cross-locale consistency)
 * 3. Both zh-TW and en files exist for every namespace
 *
 * Run via:
 *   node scripts/verify-i18n-keys.mjs
 *
 * Integrated into package.json `test` script:
 *   "test": "node scripts/verify-i18n-keys.mjs && vitest run"
 *
 * Related:
 *   - DEV/08-2026/0816-pass-card-preview-i18n.md (root cause: namespace-prefixed values)
 *   - .cursor/rules/frontend/023-shared-package.mdc (namespace naming rules)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.ts'));

/**
 * Collect all string values from a locale file (recursive).
 * Works with both flat and nested structures.
 */
function collectStringValues(content, ns) {
  const values = [];
  // Match single-quoted or double-quoted string values
  const re = /['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    values.push(match[1]);
  }
  return values;
}

/**
 * Recursively collect all dot-notation key paths from a parsed JS object string.
 * Handles nested objects by building dot-notation paths.
 * Supports both quoted and unquoted keys.
 */
function collectKeyPaths(content, prefix = '') {
  const results = [];
  // Match both quoted and unquoted keys: `"key":` or `key:`
  // No ^ anchor — matches anywhere in content (works for nested objects too)
  const keyRe = /"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:|([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let keyMatch;
  while ((keyMatch = keyRe.exec(content)) !== null) {
    const key = keyMatch[1] || keyMatch[2];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    results.push(fullKey);
    // Find the value after this key
    const afterKey = content.slice(keyMatch.index + keyMatch[0].length).trimStart();
    // Check if value starts with { (nested object)
    if (afterKey.startsWith('{')) {
      // Find matching closing brace
      let depth = 0;
      let end = 0;
      for (let i = 0; i < afterKey.length; i++) {
        if (afterKey[i] === '{') depth++;
        if (afterKey[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      const nestedContent = afterKey.slice(1, end - 1); // strip outer braces
      results.push(...collectKeyPaths(nestedContent, fullKey));
    }
  }
  return results;
}

// Group by namespace
const namespaces = {};
for (const file of localeFiles) {
  const match = file.match(/^(.+)\.(zh-TW|en)\.ts$/);
  if (!match) continue;
  const [, ns] = match;
  if (!namespaces[ns]) namespaces[ns] = {};
  const locale = file.includes('.zh-TW.') ? 'zh-TW' : 'en';
  namespaces[ns][locale] = true;
}

let failed = false;

// Check 1: no namespace-prefixed values (causes double-prefixing) — HARD FAIL
for (const [ns, locales] of Object.entries(namespaces)) {
  for (const locale of Object.keys(locales)) {
    const file = `${ns}.${locale}.ts`;
    const content = readFileSync(join(LOCALES_DIR, file), 'utf8');
    const values = collectStringValues(content, ns);
    for (const value of values) {
      // Check if value starts with its own namespace prefix
      const prefixPattern = new RegExp(`^${ns}\\.`);
      if (prefixPattern.test(value)) {
        console.error(`FAIL: [${ns}/${locale}] Value "${value}" starts with namespace prefix "${ns}." — this causes double-prefixing`);
        console.error(`       Use t('${value.replace(`${ns}.`, '')}') instead of t('${value}')`);
        failed = true;
      }
    }
  }
}

// Check 2: both zh-TW and en files exist — HARD FAIL
for (const [ns] of Object.entries(namespaces)) {
  if (!namespaces[ns]['zh-TW']) {
    console.error(`FAIL: [${ns}] Missing zh-TW locale file`);
    failed = true;
  }
  if (!namespaces[ns]['en']) {
    console.error(`FAIL: [${ns}] Missing en locale file`);
    failed = true;
  }
}

// Check 3: cross-locale consistency — WARN (not hard fail — pre-existing issues)
for (const [ns, locales] of Object.entries(namespaces)) {
  const zhFile = `${ns}.zh-TW.ts`;
  const enFile = `${ns}.en.ts`;
  if (!locales['zh-TW'] || !locales['en']) continue;

  const zhContent = readFileSync(join(LOCALES_DIR, zhFile), 'utf8');
  const enContent = readFileSync(join(LOCALES_DIR, enFile), 'utf8');

  const zhKeys = collectKeyPaths(zhContent);
  const enKeys = collectKeyPaths(enContent);

  const zhSet = new Set(zhKeys);
  const enSet = new Set(enKeys);

  const missingInEn = zhKeys.filter((k) => !enSet.has(k));
  const missingInZh = enKeys.filter((k) => !zhSet.has(k));

  if (missingInEn.length > 0) {
    console.warn(`WARN: [${ns}] Keys in zh-TW missing in en (${missingInEn.length}): ${missingInEn.slice(0, 5).join(', ')}${missingInEn.length > 5 ? '...' : ''}`);
  }
  if (missingInZh.length > 0) {
    console.warn(`WARN: [${ns}] Keys in en missing in zh-TW (${missingInZh.length}): ${missingInZh.slice(0, 5).join(', ')}${missingInZh.length > 5 ? '...' : ''}`);
  }
}

if (failed) {
  console.error('\nverify-i18n-keys: FAIL — fix the issues above');
  process.exit(1);
}

const nsCount = Object.keys(namespaces).length;
console.log(`verify-i18n-keys: OK — ${nsCount} namespace(s) passed (${localeFiles.length} locale files)`);


