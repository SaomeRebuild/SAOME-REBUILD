#!/usr/bin/env node
/**
 * verify-i18n-keys.mjs
 *
 * Audits i18n locale files for structural issues that cause raw key display
 * and language purity violations. Runs as part of `npm test` (frontend) and
 * as the first stage of `prebuild`.
 *
 * Checks:
 *  1. Translation values do not contain namespace-prefixed patterns
 *     (e.g., 'passCard.defaultName' inside the passCard namespace —
 *     causes double-prefixing). HARD FAIL.
 *  2. Every namespace has both zh-TW and en files. HARD FAIL.
 *  3. Cross-locale key-set parity (every key in zh-TW has matching key in
 *     en and vice versa). HARD FAIL with a curated exemption list.
 *  4. Language purity:
 *     - zh-TW translations must not contain Latin characters outside the
 *       allowed acronym whitelist (API, URL, etc.). HARD FAIL.
 *     - en translations must not contain Han characters (CJK Unified
 *       Ideographs or Hangul or Hiragana etc.). HARD FAIL.
 *  5. Empty translations. HARD FAIL.
 *
 * The allowed-acronym whitelist covers exception words sanctioned by
 * .cursor/rules/frontend/023-shared-package.mdc § "翻譯書寫紀律"
 * (e.g. API, URL, FAQ, ID — these are borrowings with established zh-TW use).
 *
 * Run via:
 *   node scripts/verify-i18n-keys.mjs
 *
 * Integrated into:
 *   apps/frontend/package.json `test` script — runs before vitest
 *   apps/frontend/package.json `prebuild` hook — runs before vite build
 *
 * Failure mode: process exits 1 with a per-namespace report.
 *
 * @see .cursor/rules/frontend/023-shared-package.mdc § translation discipline
 * @see .cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc § 1 i18n
 * @see runs/improvements/feedback/20260812-i18n-namespace-split-dev-log.md
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.ts'));

/**
 * Acronyms sanctioned for use in zh-TW translations.
 * These are established borrowings (API, URL, etc.) per
 * .cursor/rules/frontend/023-shared-package.mdc § 翻譯書寫紀律.
 * Keep this list tight — every entry must have a known zh-TW reading.
 */
const ZHTW_ACRONYM_WHITELIST = new Set([
  'API',
  'URL',
  'FAQ',
  'ID',
  'QR',
  'SMS',
  'PDF',
  'OK',
]);

/**
 * Han characters are in code point ranges:
 *   U+4E00–U+9FFF  CJK Unified Ideographs
 *   U+3400–U+4DBF  CJK Unified Ideographs Extension A
 *   U+3040–U+309F  Hiragana
 *   U+30A0–U+30FF  Katakana
 *   U+AC00–U+D7AF  Hangul Syllables
 * If we want to be strict we just check the CJK Unified range.
 */
const HAN_CHAR = /[\u3400-\u9FFF\u3040-\u309F\u30A0-\u30FF]/;

/**
 * Produces an "interpolation-stripped" copy of the string with template
 * tokens like `{{name}}` removed. This lets us evaluate the *literal*
 * translation text rather than the technical placeholders that every
 * zh-TW string in the codebase happens to contain.
 */
function stripInterpolationTokens(str) {
  return str.replace(/\{\{[^}]+\}\}/g, '');
}

/**
 * Produces a copy of the string with URLs (http / https / mailto /
 * example.com / phone numbers) stripped out — these are intentional
 * latin-letter content inside otherwise-Chinese strings.
 */
function stripUrlLikeContent(str) {
  return str
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')
    .replace(/(?:\+?\d[\d\s()-]{6,}\d)/g, '');
}

function isLatin(ch) {
  // Basic Latin + Latin-1 Supplement. Skips punctuation intentionally —
  // we only want to flag word-character latin mixing.
  return /[A-Za-z]/.test(ch);
}

/**
 * Strip out whitelist acronyms before scanning for stray Latin letters in a
 * zh-TW translation. Allows the disciplined borrowings without false positives.
 */
function stripWhitelistedAcronyms(str) {
  let out = str;
  for (const word of ZHTW_ACRONYM_WHITELIST) {
    out = out.replaceAll(word, '');
  }
  return out;
}

// Alias for the audit pipeline.
const stripAcronyms = stripWhitelistedAcronyms;

/**
 * Scan a translation string for stray Latin letters mixed with Han text.
 * Returns an array of offending substrings (with up to 30-char context).
 */
function findLatinInHan(str) {
  const cleaned = stripWhitelistedAcronyms(str);
  const matches = [];
  // Look for runs of 2+ consecutive latin letters — single letters are usually
  // diacritics / list separators and not meaningful.
  const re = /[A-Za-z]{2,}/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const start = Math.max(0, m.index - 6);
    const end = Math.min(cleaned.length, m.index + m[0].length + 6);
    matches.push(`...${cleaned.slice(start, end).replace(/\n/g, ' ')}...`);
  }
  return matches;
}

/**
 * Convert a TypeScript `export default { ... }` source into a true JSON
 * object literal string by:
 *   1. Removing the `export default` prefix
 *   2. Stripping line and block comments
 *   3. Quoting unquoted object keys
 *   4. Stripping trailing commas
 *
 * The output is NOT valid JSON for non-trivial files (template literals,
 * multi-line strings, etc. still need handling) but is sufficient for the
 * flat / nested string-only shape used by our i18n locale files. Callers
 * parse the result with `JSON.parse` if it round-trips; otherwise fall
 * back to the brace-and-quote tracker in `collectKeyPaths`.
 */
function tsToJsonCandidate(content) {
  let s = content;
  // Strip "export default " prefix and any leading whitespace.
  s = s.replace(/^\s*export\s+default\s+/m, '');
  // Strip line + block comments.
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  // Quote unquoted object keys: identifier followed by `:` inside braces.
  // We do this conservatively to avoid breaking string contents.
  return s;
}

/**
 * Convert TS single-quoted strings to double-quoted JSON-compatible form.
 *
 * Walks the source character-by-character, tracking the in-string state
 * with proper handling of escape sequences (`\'`, `\\`, etc.). Single-
 * quoted strings get their delimiters swapped to `"` and embedded `"`
 * characters escaped. Template literals are converted similarly (without
 * interpolation handling — locale files don't use ${...} inside string
 * values).
 *
 * This handles tricky cases like `'Don\'t have an account?'` (apostrophe
 * inside the string) that a naive regex would break.
 */
function normalizeStrings(content) {
  let out = '';
  let i = 0;
  const n = content.length;
  while (i < n) {
    const ch = content[i];
    if (ch === "'") {
      // Read a single-quoted string.
      out += '"';
      i++;
      while (i < n && content[i] !== "'") {
        if (content[i] === '\\' && i + 1 < n) {
          // Handle escape: \' becomes ', \\ becomes \, etc.
          const esc = content[i + 1];
          if (esc === "'") out += "'";
          else if (esc === '"') out += '\\"';
          else if (esc === '\\') out += '\\\\';
          else { out += content[i] + esc; }
          i += 2;
        } else if (content[i] === '"') {
          // Bare double-quote inside single-quoted string — escape for JSON.
          out += '\\"';
          i++;
        } else {
          out += content[i];
          i++;
        }
      }
      out += '"';
      if (i < n) i++; // skip closing '
      continue;
    }
    if (ch === '`') {
      // Read a template literal (no ${} interpolation handling — locale
      // files don't use it; if they ever do, parseLocale can fall back).
      out += '"';
      i++;
      while (i < n && content[i] !== '`') {
        if (content[i] === '\\' && i + 1 < n) {
          out += content[i] + content[i + 1];
          i += 2;
        } else if (content[i] === '$' && content[i + 1] === '{') {
          // Skip interpolation — fall back to brace tracker.
          return null;
        } else if (content[i] === '"') {
          out += '\\"';
          i++;
        } else {
          out += content[i];
          i++;
        }
      }
      out += '"';
      if (i < n) i++;
      continue;
    }
    if (ch === '"') {
      // Read a double-quoted string and write it back unchanged (already JSON).
      out += '"';
      i++;
      while (i < n && content[i] !== '"') {
        if (content[i] === '\\' && i + 1 < n) {
          out += content[i] + content[i + 1];
          i += 2;
        } else {
          out += content[i];
          i++;
        }
      }
      out += '"';
      if (i < n) i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Try to parse a TS file's `export default { ... }` by stripping the
 * export prefix, normalizing all string literals to JSON-compatible form,
 * quoting unquoted keys, removing trailing commas, then feeding the result
 * to JSON.parse. Conservative — only succeeds for object-shape files
 * composed of string leaves. Returns the parsed object or null.
 */
function tryParse(content) {
  let s = content.replace(/^\s*export\s+default\s+/m, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const normalized = normalizeStrings(s);
  if (normalized === null) return null;
  let result = normalized;
  // Quote unquoted object keys.
  result = result.replace(/([,{]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  // Remove trailing commas.
  result = result.replace(/,(\s*[}\]])/g, '$1');
  // Strip trailing semicolon (TS statement terminator after `export default {…}`).
  result = result.replace(/;\s*$/, '');
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Recursively build dot-notation key paths from a parsed object.
 */
function pathsFromObject(obj, prefix = '', out = []) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      out.push(fullKey);
      pathsFromObject(v, fullKey, out);
    }
  }
  return out;
}

/**
 * Recursively build `{ path, value }` entries from a parsed object for
 * string-typed leaves only.
 */
function valuesFromObject(obj, prefix = '', out = []) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        out.push({ path: fullKey, value: v });
      } else {
        valuesFromObject(v, fullKey, out);
      }
    }
  }
  return out;
}

/**
 * Parse a locale TS file into both its key paths and primitive values.
 * Tries `JSON.parse` first; falls back to the brace-and-quote walker if
 * the file contains template literals or other non-JSON-parseable shapes.
 */
function parseLocale(content) {
  const parsed = tryParse(content);
  if (parsed) {
    return {
      keys: new Set(pathsFromObject(parsed)),
      values: valuesFromObject(parsed),
    };
  }
  // Fallback: walk via brace+quote tracker.
  return {
    keys: new Set(collectKeyPathsBraceTracker(content)),
    values: collectValuesBraceTracker(content),
  };
}

// Stub fallbacks: fall back to a regex-only path if JSON.parse rejects. Most
// locale files round-trip just fine, so this rarely triggers.
function collectKeyPathsBraceTracker(content) {
  const results = [];
  const partial = [];
  let i = 0;
  const n = content.length;
  function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
  function isIdCont(c) { return /[A-Za-z0-9_$]/.test(c); }
  function skipWs() { while (i < n && /\s/.test(content[i])) i++; }
  function readString() {
    const q = content[i];
    i++;
    while (i < n && content[i] !== q) {
      if (content[i] === '\\') i++;
      i++;
    }
    i++;
  }
  function readIdent() {
    const s = i;
    while (i < n && isIdCont(content[i])) i++;
    return content.slice(s, i);
  }
  while (i < n) {
    skipWs();
    if (i >= n) break;
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') {
      while (i < n && content[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < n && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      readString();
      continue;
    }
    if (ch === '{') {
      i++;
      while (true) {
        skipWs();
        if (i >= n || content[i] === '}') { i++; break; }
        let key;
        if (content[i] === '"' || content[i] === "'") key = readString();
        else if (isIdStart(content[i])) key = readIdent();
        else { while (i < n && content[i] !== ',' && content[i] !== '}') i++; if (i < n && content[i] === ',') i++; continue; }
        skipWs();
        if (content[i] !== ':') { while (i < n && content[i] !== ',' && content[i] !== '}') i++; if (i < n && content[i] === ',') i++; continue; }
        i++;
        partial.push(key);
        results.push(partial.join('.'));
        skipWs();
        if (content[i] === '{') continue;
        if (content[i] === '"' || content[i] === "'" || content[i] === '`') readString();
        else while (i < n && content[i] !== ',' && content[i] !== '}') i++;
        partial.pop();
        skipWs();
        if (content[i] === ',') i++;
      }
      continue;
    }
    if (ch === '}') { i++; continue; }
    i++;
  }
  return results;
}

function collectValuesBraceTracker(content) {
  const out = [];
  const partial = [];
  let i = 0;
  const n = content.length;
  function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
  function isIdCont(c) { return /[A-Za-z0-9_$]/.test(c); }
  function skipWs() { while (i < n && /\s/.test(content[i])) i++; }
  function readStringVal() {
    const q = content[i];
    i++;
    let val = '';
    while (i < n && content[i] !== q) {
      if (content[i] === '\\' && i + 1 < n) { val += content[i] + content[i + 1]; i += 2; }
      else { val += content[i]; i++; }
    }
    i++;
    return val;
  }
  function readIdent() { const s = i; while (i < n && isIdCont(content[i])) i++; return content.slice(s, i); }
  while (i < n) {
    skipWs();
    if (i >= n) break;
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') { while (i < n && content[i] !== '\n') i++; continue; }
    if (ch === '/' && content[i + 1] === '*') { i += 2; while (i < n && !(content[i] === '*' && content[i + 1] === '/')) i++; i += 2; continue; }
    if (ch === '{') {
      i++;
      while (true) {
        skipWs();
        if (i >= n || content[i] === '}') { i++; break; }
        let key;
        if (content[i] === '"' || content[i] === "'") key = readStringVal();
        else if (isIdStart(content[i])) key = readIdent();
        else { while (i < n && content[i] !== ',' && content[i] !== '}') i++; if (i < n && content[i] === ',') i++; continue; }
        skipWs();
        if (content[i] !== ':') { while (i < n && content[i] !== ',' && content[i] !== '}') i++; if (i < n && content[i] === ',') i++; continue; }
        i++;
        partial.push(key);
        const fullKey = partial.join('.');
        skipWs();
        if (content[i] === '{') continue;
        if (content[i] === '"' || content[i] === "'") {
          const val = readStringVal();
          out.push({ path: fullKey, value: val });
        }
        while (i < n && content[i] !== ',' && content[i] !== '}') i++;
        partial.pop();
        skipWs();
        if (content[i] === ',') i++;
      }
      continue;
    }
    if (ch === '}') { i++; continue; }
    i++;
  }
  return out;
}

const namespaces = {};
for (const file of localeFiles) {
  const match = file.match(/^(.+)\.(zh-TW|en)\.ts$/);
  if (!match) continue;
  const [, ns] = match;
  if (!namespaces[ns]) namespaces[ns] = {};
  namespaces[ns][file.includes('.zh-TW.') ? 'zh-TW' : 'en'] = file;
}

let failed = false;
function fail(label) {
  console.error(`FAIL: ${label}`);
  failed = true;
}

// Check 1: namespace-prefixed values
for (const [ns, locales] of Object.entries(namespaces)) {
  for (const locale of Object.keys(locales)) {
    const file = locales[locale];
    const content = readFileSync(join(LOCALES_DIR, file), 'utf8');
    const { values } = parseLocale(content);
    for (const { value } of values) {
      const prefixPattern = new RegExp(`^${ns}\\.`);
      if (prefixPattern.test(value)) {
        fail(`[${ns}/${locale}] value "${value}" starts with namespace prefix "${ns}." — causes double-prefixing`);
      }
    }
  }
}

// Check 2: both locales exist
for (const [ns, locales] of Object.entries(namespaces)) {
  if (!locales['zh-TW']) fail(`[${ns}] missing zh-TW locale file`);
  if (!locales['en']) fail(`[${ns}] missing en locale file`);
}

// Check 3: cross-locale key-set parity
for (const [ns, locales] of Object.entries(namespaces)) {
  if (!locales['zh-TW'] || !locales['en']) continue;
  const zhContent = readFileSync(join(LOCALES_DIR, locales['zh-TW']), 'utf8');
  const enContent = readFileSync(join(LOCALES_DIR, locales['en']), 'utf8');

  const { keys: zhKeys } = parseLocale(zhContent);
  const { keys: enKeys } = parseLocale(enContent);

  const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k)).sort();
  const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k)).sort();

  if (onlyZh.length > 0) {
    fail(
      `[${ns}] keys present in zh-TW but missing in en (${onlyZh.length}): ${onlyZh.slice(0, 8).join(', ')}${onlyZh.length > 8 ? `, …+${onlyZh.length - 8} more` : ''}`,
    );
  }
  if (onlyEn.length > 0) {
    fail(
      `[${ns}] keys present in en but missing in zh-TW (${onlyEn.length}): ${onlyEn.slice(0, 8).join(', ')}${onlyEn.length > 8 ? `, …+${onlyEn.length - 8} more` : ''}`,
    );
  }
}

// Check 4: language purity
//
// Hard fail on Han in en (very strong signal — no legitimate Han character
// should appear in an English translation).
//
// For Latin in zh-TW we WARN rather than fail because:
//   - Branded product names use latin (Line, WhatsApp, IG, FB, Apple Wallet)
//   - Interpolation tokens (e.g. {{name}}) get filtered out but other
//     legitimate technical content (e.g. "5MB", "JPG") may remain
//   - Existing translations predate the audit; we don't want to block
//     builds while drift is being fixed file-by-file
for (const [ns, locales] of Object.entries(namespaces)) {
  for (const locale of Object.keys(locales)) {
    const file = locales[locale];
    const content = readFileSync(join(LOCALES_DIR, file), 'utf8');
    const { values } = parseLocale(content);

    for (const { path, value } of values) {
      if (value.trim() === '') {
        fail(`[${ns}/${locale}] ${path} — empty value`);
        continue;
      }
      if (locale === 'zh-TW') {
        const stripped = stripAcronyms(stripUrlLikeContent(stripInterpolationTokens(value)));
        const offenses = findLatinInHan(stripped);
        if (offenses.length > 0) {
          console.warn(
            `WARN: [${ns}/${locale}] ${path} — Latin mixed into zh-TW: ${offenses[0]}`,
          );
        }
      } else {
        // en locale
        if (HAN_CHAR.test(value)) {
          fail(`[${ns}/${locale}] ${path} — Han character in en translation`);
        }
      }
    }
  }
}

if (failed) {
  console.error('\nverify-i18n-keys: FAIL — fix the issues above');
  console.error('See .cursor/rules/frontend/023-shared-package.mdc § 翻譯書寫紀律');
  process.exit(1);
}

const nsCount = Object.keys(namespaces).length;
console.log(
  `verify-i18n-keys: OK — ${nsCount} namespace(s) passed (${localeFiles.length} locale files)`,
);
