#!/usr/bin/env node
/**
 * cross-locale-drift-report.mjs
 *
 * One-off audit script for Phase 5.16 — lists every cross-locale drift
 * with the full en value as a translation reference. Output is meant to
 * be eyeballed by a translator to fix drift file-by-file.
 *
 * Usage:
 *   node apps/frontend/scripts/cross-locale-drift-report.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales');

function collectKeyPaths(content, prefix = '') {
  const results = [];
  const keyRe = /"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:|([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let keyMatch;
  while ((keyMatch = keyRe.exec(content)) !== null) {
    const key = keyMatch[1] || keyMatch[2];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    results.push(fullKey);
    const afterKey = content.slice(keyMatch.index + keyMatch[0].length).trimStart();
    if (afterKey.startsWith('{')) {
      let depth = 0;
      let end = 0;
      for (let i = 0; i < afterKey.length; i++) {
        if (afterKey[i] === '{') depth++;
        if (afterKey[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > 0) {
        const nestedContent = afterKey.slice(1, end - 1);
        results.push(...collectKeyPaths(nestedContent, fullKey));
      }
    }
  }
  return results;
}

function collectStringValues(content, prefix = '', out = []) {
  const keyRe = /"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:|([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let keyMatch;
  while ((keyMatch = keyRe.exec(content)) !== null) {
    const key = keyMatch[1] || keyMatch[2];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const afterKey = content.slice(keyMatch.index + keyMatch[0].length).trimStart();
    if (afterKey.startsWith('{')) {
      let depth = 0;
      let end = 0;
      for (let i = 0; i < afterKey.length; i++) {
        if (afterKey[i] === '{') depth++;
        if (afterKey[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      if (end > 0) {
        const nestedContent = afterKey.slice(1, end - 1);
        collectStringValues(nestedContent, fullKey, out);
      }
      keyRe.lastIndex = keyMatch.index + keyMatch[0].length + end;
      continue;
    }
    const valMatch = afterKey.match(/^(['"])(.*?)\1/);
    if (valMatch) {
      out.push({ path: fullKey, value: valMatch[2] });
      keyRe.lastIndex = keyMatch.index + keyMatch[0].length + valMatch[0].length;
    }
  }
  return out;
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.ts'));
const byNs = {};
for (const f of files) {
  const m = f.match(/^(.+)\.(zh-TW|en)\.ts$/);
  if (!m) continue;
  const [, ns] = m;
  if (!byNs[ns]) byNs[ns] = {};
  byNs[ns][m[2]] = f;
}

let totalDrift = 0;
for (const [ns, locales] of Object.entries(byNs)) {
  if (!locales['zh-TW'] || !locales['en']) continue;
  const zh = readFileSync(join(LOCALES_DIR, locales['zh-TW']), 'utf8');
  const en = readFileSync(join(LOCALES_DIR, locales['en']), 'utf8');
  const zhKeys = new Set(collectKeyPaths(zh));
  const enKeys = new Set(collectKeyPaths(en));
  const enVals = collectStringValues(en);

  const onlyInEn = [...enKeys].filter((k) => !zhKeys.has(k)).sort();
  if (onlyInEn.length === 0) continue;

  console.error(`\n[${ns}] ${onlyInEn.length} keys in en missing in zh-TW:`);
  totalDrift += onlyInEn.length;
  for (const k of onlyInEn) {
    const ref = enVals.find((e) => e.path === k);
    if (ref) {
      console.error(`  ${k} = ${JSON.stringify(ref.value)}`);
    } else {
      console.error(`  ${k} (intermediate key, no primitive)`);
    }
  }
}

console.error(`\nTotal cross-locale drift: ${totalDrift}`);
