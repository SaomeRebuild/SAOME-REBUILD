# CI cross-realm Blob `instanceof` flake — 2026-09-27

## Summary

PR #263 (`567c23d` moduleSuffixes fix) blocked by 1 failing unit test in CI Linux,
passing on local Windows. Test: `httpClient.test.ts > HttpClient — getBlob binary
download > returns the response body as a Blob (NOT parsed as JSON)`.

Failure:
```
AssertionError: expected Blob { size: 33, type: 'image/png' } to be an instance of Blob
 ❯ src/services/httpClient.test.ts:562:18
```

Local repro: passes. CI Linux Node 20: fails.

## Root cause

`expect(blob).toBeInstanceOf(Blob)` is a **cross-realm-unsafe** check.

| Realm | `Blob` class identity | `Response.blob()` returns | `instanceof Blob` |
|---|---|---|---|
| Local Windows + vitest 3.2.7 + jsdom 25.0.1 | jsdom `Blob` | jsdom `Blob` (same realm) | ✅ true |
| CI Linux Node 20 + vitest 3.2.7 + jsdom 25.0.1 | jsdom `Blob` | **different realm's** `Blob` | ❌ false |

The `Blob` *is* a Blob (the error message itself prints `Blob { size: 33, type: 'image/png' }`),
but the `Blob` reference in the test file's realm and the `Blob` returned by
`Response.blob()` come from different realms. `instanceof` walks the prototype
chain which is realm-local, so it returns false.

**Probe result** (local vitest jsdom environment):
```
jsdomBlob === NodeBlob: false                                  ← different references
b instanceof jsdomBlob: true                                   ← jsdom response.blob() returns jsdom Blob
b instanceof NodeBlob: false                                   ← but not Node's Blob
Object.prototype.toString.call(b): [object Blob]               ← canonical check works on any realm
```

CI Linux triggers this because the polyfill chain / module loader takes a different
path (jsdom 25 + Node 20 + undici Response + jsdom Response interaction is
platform-sensitive). On Windows the same versions land in the same realm.

## Why dev mode + previous CI runs passed

- `vite dev` does not run unit tests.
- The previous CI run on commit `6818273` (which introduced this test) ran on a
  Linux machine, but either:
  - jsdom realm alignment was different (cache hit on `node_modules` from a
    earlier install), OR
  - The test passed by luck on a specific jsdom 25 / Node 20 patch version.
- This run re-installed dependencies after the `567c23d` rule doc change touched
  no test code, but the lockfile drift or cache invalidation re-aligned the
  realm boundary.

The test is **flake-prone** — same code can pass or fail across CI runs.

## Fix

Replace realm-coupled `toBeInstanceOf(Blob)` with canonical cross-realm-safe check:

```ts
function isBlob(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.toString.call(value) === '[object Blob]'
  );
}

// usage
expect(isBlob(blob)).toBe(true);
```

`Object.prototype.toString.call(x) === '[object Blob]'` returns the same tag for
every Blob implementation — jsdom, Node `node:buffer`, workerd, browser. This
is the **canonical** cross-realm type check (the only one that survives realm
boundaries).

## Why not the alternatives

| Alternative | Why not |
|---|---|
| `import { Blob } from 'node:buffer'; expect(b).toBeInstanceOf(Blob)` | Couples test to Node-specific Blob. Fails in jsdom-only or browser env. |
| `expect(blob).toEqual(expect.any(Blob))` | Vitest `expect.any()` uses `instanceof` internally — same realm issue. |
| Use `globalThis.Blob` directly | Same realm issue as `Blob` — vitest's global proxy may differ per test file. |
| Skip the assertion, only check `size`/`type` | Loses the "is a Blob" invariant the test was originally asserting. |
| Mock `Response.blob()` to return a known-realm Blob | Adds production-shaping code to test infra; cross-realm issue can recur in other tests. |

`isBlob()` helper at top of file is shared across the `httpClient.test.ts`
getBlob describe block. Reused for any future cross-realm Blob assertion in the
same file.

## Scope of fix

Only `apps/frontend/src/services/httpClient.test.ts` is changed:
- Added module-level `isBlob()` helper (cross-realm-safe Blob detector)
- Replaced `expect(blob).toBeInstanceOf(Blob)` with `expect(isBlob(blob)).toBe(true)`
  in the getBlob regression test
- Inline comment explains the regression + cross-realm rationale

The other test that uses `toBeInstanceOf(Blob)`
(`cardService.downloadTableCardBlob.test.ts:32`) is **NOT changed** because:
1. It passes in CI (it constructs `new Blob(...)` in the test realm and passes
   it through unchanged, so same-realm).
2. Minimal-change principle per Rule 006.

Future cross-realm-safety audit recommended: any test that calls
`response.blob()` / `response.arrayBuffer()` / `response.formData()` and then
asserts the result with `instanceof` is at risk. Rule to add: prefer
`Object.prototype.toString.call(x)` for any built-in type that has realm
boundaries (Blob, ArrayBuffer, FormData, ReadableStream, Headers, Request,
Response).

## Verification

Local (Windows Node + vitest 3.2.7 + jsdom 25.0.1):
- `npx vitest run src/services/httpClient.test.ts` → 20/20 pass
- `npm test` (full suite) → 127 files, 1664/1664 pass (was 1663 passed + 1 failed)
- `npx tsc -b --noEmit` → exit 0
- `npm run lint` → exit 0 (only pre-existing warnings)

CI expected (Linux Node 20 + same vitest/jsdom):
- Full suite passes, including the cross-realm-flaky `getBlob` test.

## Prevention — future test infra rule

Add to `.cursor/rules/frontend/024-mobile-future-proof.mdc` § Hook Split Pattern
or a new "Cross-Realm Type Checks" rule:

> When asserting that a value is a built-in type with realm boundaries
> (Blob, ArrayBuffer, FormData, ReadableStream, Headers, Request, Response),
> **never** use `toBeInstanceOf(Type)` — use
> `expect(Object.prototype.toString.call(value)).toBe('[object Type]')`
> or the equivalent `expect.any(Type)` (Vitest's `expect.any` does NOT help —
> it uses instanceof internally).

(Decision deferred to follow-up PR — keep this commit minimal.)

## Commit plan

- Single commit: `fix(test): cross-realm-safe Blob check for getBlob regression test`
- Same commit includes this feedback (Rule 011-dev)
- Push to origin/main (Rule 025 — operation layer must push)