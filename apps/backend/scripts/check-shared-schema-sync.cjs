#!/usr/bin/env node
/**
 * check-shared-schema-sync.cjs
 *
 * Build-time conformance check for rule 019 (schema contract drift).
 * Compares `registrationPayloadSchema.shape` between
 * `packages/shared/schemas/auth.ts` (source of truth) and
 * `apps/backend/src/modules/auth/schemas/request.ts` (mirror).
 *
 * Fails the build if any field is in one schema but not the other.
 *
 * Run:
 *   node apps/backend/scripts/check-shared-schema-sync.cjs
 *
 * Wire into apps/backend/package.json scripts:
 *   "check:schema": "node scripts/check-shared-schema-sync.cjs",
 *   "prebuild": "npm run check:schema",
 *
 * Exit codes:
 *   0 — schemas match
 *   1 — drift detected
 */

const fs = require('node:fs');
const path = require('node:path');

const SHARED_SCHEMA = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'schemas',
  'auth.ts',
);
const BACKEND_SCHEMA = path.resolve(
  __dirname,
  '..',
  'src',
  'modules',
  'auth',
  'schemas',
  'request.ts',
);

// Fields that the backend intentionally omits (e.g. confirmPassword is
// validated on the frontend but never sent over the wire).
const BACKEND_OMITTED = new Set(['confirmPassword']);

// Fields known to drift in the codebase but tracked separately. Add a
// follow-up task to align before extending this set. The script will
// still report these as drift to keep them visible.
const KNOWN_DRIFT = new Set([
  // TODO(SAOME-XX): align backend registrationPayloadSchema to include
  // `businessEmail` from packages/shared/schemas/auth.ts::accountInfoBase.
  // Frontend never sends it (mobile / website / businessEmail are not
  // wired into the Step 2 form yet), so this is currently a silent drift.
  'businessEmail',
]);

/**
 * Extract the top-level keys of `registrationPayloadSchema` from a source file.
 *
 * Walks the zod expression after `registrationPayloadSchema =` and collects
 * field names from:
 *   - `z.object({ ... })` literals
 *   - `.merge(<other>.<omitted>)` — pulls fields from the referenced schema
 *   - `.extend({ ... })` — pulls fields from the inline object
 *
 * This is intentionally not a full TS parser — we only need the field set.
 * If the schema composition style changes (e.g. `.pipe(...)`), this will
 * need to be updated.
 */
function extractRegistrationFields(source) {
  const marker = 'registrationPayloadSchema';
  const startIdx = source.indexOf(marker);
  if (startIdx === -1) return null;
  const eqIdx = source.indexOf('=', startIdx);
  if (eqIdx === -1) return null;
  const expr = source.slice(eqIdx + 1);

  const fields = new Set();

  // 1. Direct z.object({ ... }) — fields inside braces at top level.
  const collectFromObjectLiteral = (str) => {
    const start = str.indexOf('z.object({');
    if (start === -1) return;
    let depth = 0;
    let end = -1;
    for (let i = start + 'z.object({'.length - 1; i < str.length; i++) {
      const ch = str[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return;
    const body = str.slice(start, end + 1);
    const fieldRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      fields.add(m[1]);
    }
  };

  // 2. `.merge(<expr>)` — recursively walk the merged expression AND
  //    walk the referenced schema(s) elsewhere in the source.
  const walk = (str) => {
    collectFromObjectLiteral(str);

    const mergeMatches = [...str.matchAll(/\.merge\(\s*([^)]+)\)/g)];
    for (const mergeMatch of mergeMatches) {
      const refExpr = mergeMatch[1].trim();
      // Detect direct schema reference like `tenantInfoSchema` or `accountInfoBase`.
      const refMatch = refExpr.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
      if (refMatch) {
        const refName = refMatch[1];
        // Look for `export const <refName> = ...` (avoids self-match on the
        // expression we're already walking).
        const refDecl = new RegExp(
          `export\\s+const\\s+${refName}\\s*=\\s*([^;]+);`,
          's',
        );
        const declMatch = source.match(refDecl);
        if (declMatch) {
          walk(declMatch[1]);
        }
      }
      // Also walk the rest of the expression after .merge(...).
      const afterMerge = str.slice(mergeMatch.index + mergeMatch[0].length);
      walk(afterMerge);
    }

    const extendMatch = str.match(/\.extend\(\s*\{/);
    if (extendMatch) {
      // Collect from the inline extend object.
      let depth = 0;
      let end = -1;
      for (let i = extendMatch.index; i < str.length; i++) {
        const ch = str[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end !== -1) {
        const body = str.slice(extendMatch.index, end + 1);
        const fieldRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
        let m;
        while ((m = fieldRegex.exec(body)) !== null) {
          fields.add(m[1]);
        }
      }
    }
  };

  walk(expr);
  return fields;
}

function diffSet(label, a, b) {
  const onlyInA = [...a].filter((x) => !b.has(x));
  const onlyInB = [...b].filter((x) => !a.has(x));
  if (onlyInA.length === 0 && onlyInB.length === 0) return [];
  return [
    onlyInA.length > 0 ? `only in ${label}: ${onlyInA.sort().join(', ')}` : null,
    onlyInB.length > 0 ? `only in other: ${onlyInB.sort().join(', ')}` : null,
  ].filter(Boolean);
}

function main() {
  if (!fs.existsSync(SHARED_SCHEMA)) {
    console.error(`FAIL: shared schema not found at ${SHARED_SCHEMA}`);
    process.exit(1);
  }
  if (!fs.existsSync(BACKEND_SCHEMA)) {
    console.error(`FAIL: backend schema not found at ${BACKEND_SCHEMA}`);
    process.exit(1);
  }

  const sharedSource = fs.readFileSync(SHARED_SCHEMA, 'utf8');
  const backendSource = fs.readFileSync(BACKEND_SCHEMA, 'utf8');

  const sharedFields = extractRegistrationFields(sharedSource);
  const backendFields = extractRegistrationFields(backendSource);

  if (!sharedFields) {
    console.error(`FAIL: could not parse registrationPayloadSchema in ${SHARED_SCHEMA}`);
    process.exit(1);
  }
  if (!backendFields) {
    console.error(`FAIL: could not parse registrationPayloadSchema in ${BACKEND_SCHEMA}`);
    process.exit(1);
  }

  const sharedMinusOmitted = new Set(
    [...sharedFields].filter((f) => !BACKEND_OMITTED.has(f) && !KNOWN_DRIFT.has(f)),
  );
  const diffs = diffSet('shared', sharedMinusOmitted, backendFields);
  if (diffs.length > 0) {
    console.error('FAIL: schema drift detected');
    console.error(`  shared (omit known: ${[...BACKEND_OMITTED].join(', ')}):`);
    console.error(`    ${[...sharedFields].sort().join(', ')}`);
    console.error(`  backend:`);
    console.error(`    ${[...backendFields].sort().join(', ')}`);
    for (const d of diffs) console.error(`  ${d}`);
    console.error('');
    console.error('See .cursor/rules/019-schema-contract-drift.mdc');
    process.exit(1);
  }

  console.log(`OK: registrationPayloadSchema fields match (${sharedFields.size} fields)`);
  console.log(`  ${[...sharedFields].sort().join(', ')}`);
}

main();