# Step 8 v4.1 — Passcreator create response id-parse regression (2026-10-12)

**Context**: Follow-up to the 2026-10-11 Step 8 Passcreator push
(`runs/improvements/feedback/20261011-step8-passcreator-push.md`).
Two production template pushes returned the V2 success envelope but
the backend surfaced `create response missing id` to the frontend
banner, blocking the publish flow.

## Symptom

User reported two consecutive template pushes on 2026-10-12:

```
Template 1: 85b855a5-ec86-4fd6-a48e-892ed143ae0f
Template 2: c23e1a46-fdc5-4c70-8728-c04f1dfc5db2
```

Both produced this exact upstream response (HTTP 201):

```json
{
  "success": true,
  "description": "Template was created successfully!",
  "errors": [],
  "data": {
    "identifier": "<UUID>"
  },
  "statusCode": 201
}
```

Both surfaced in the frontend as:

```
Passcreator sync failed.
Your card was saved locally, but the sync to Passcreator was rejected.
Error details
create response missing id: {"success":true,"description":"Template was created successfully!","errors":[],"data":{"identifier":"85b855a5-ec86-4fd6-a48e-892ed143ae0f"},"statusCode":201}
```

The card was silently **not** created upstream despite the 201 — the
backend parser rejected the response and never persisted
`passcreator_template_id` to the DB row.

## Root cause

`shared/lib/passcreator.ts::createPassTemplate` read the new id from
top-level `result.id`:

```ts
// ❌ before
const id = (result as { id?: unknown } | null)?.id;
if (typeof id !== 'string' || id.length === 0) {
  throw new BadGatewayError({
    upstream: 'passcreator',
    upstreamBody: `create response missing id: ${JSON.stringify(result)}`,
  });
}
```

But the Passcreator V2 envelope puts the id at `data.identifier`,
not at top-level `id`. The 2026-10-11 docblock on
`PasscreatorTemplateResponse` already called this out:

> NOTE: Per V2 docs (2026-10-11), the actual envelope nests the id
> under `data.identifier`. The current parser still reads top-level
> `id` because the test fixtures use that shape. A future fix should
> align the parser to `data.identifier`. See `passcreator-err-2.json`
> for the real success-shape example.

That "future fix" was this PR.

## Fix

`shared/lib/passcreator.ts`:

```ts
// ✅ after
function extractTemplateId(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // V2 envelope: read data.identifier first.
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const identifier = (data as Record<string, unknown>).identifier;
    if (typeof identifier === 'string' && identifier.length > 0) {
      return identifier;
    }
  }
  // Legacy / test-double: top-level id (kept for robustness).
  const topLevel = obj.id;
  if (typeof topLevel === 'string' && topLevel.length > 0) {
    return topLevel;
  }
  return null;
}
```

Both `createPassTemplate` (create path) and `updatePassTemplate`
(update path) now read through `extractTemplateId`. Error message
updated to point operators at the expected field:

```ts
upstreamBody: `create response missing id (expected data.identifier): ${JSON.stringify(result)}`,
```

## Why this was missed earlier

| Surface | Why the bug was invisible |
|---------|----------------------------|
| **Unit tests** | The 2026-10-11 test fixtures for `createPassTemplate` used a synthetic `{ id: 'pc-123' }` shape, exercising the legacy code path. No fixture pinned the real V2 success envelope. |
| **Type system** | `PasscreatorTemplateResponse` is typed as `{ id: string }` — the upstream payload type wasn't modeled, so there was no compile-time signal pointing to `data.identifier`. |
| **Docblock** | The 2026-10-11 docblock noted "future fix" but the parser wasn't updated alongside the docblock. The TODO was technical debt, not a tracked action item. |
| **Production smoke test** | Not run after the 2026-10-11 push — the curl 3-route audit covered `/icon` / `/background` / `/logo` but not the Passcreator create path end-to-end. |

## Conformance tests added (regression guard)

`apps/backend/src/shared/lib/passcreator.test.ts`:

| Test | What it pins |
|------|--------------|
| `returns data.identifier from the V2 envelope (happy path)` | Live V2 success envelope parses to `{ id: 'pc-v2-123' }` |
| `falls back to top-level id when data.identifier is missing (legacy / test-double)` | Backwards-compat with the 2026-10-11 fixture shape |
| `live V2 envelope shape (regression — 2026-10-12 production push)` | Exact bytes from the failing 85b855a5 push |
| `throws BadGatewayError when response is missing id (neither data.identifier nor top-level id)` | Defensive: `data: []` (empty array) still throws |
| `returns data.identifier from the V2 envelope (happy path)` (update) | Same parser fixed for PUT |
| `falls back to existing id when success envelope has data: [] (no id anywhere)` | PUT semantics: 2xx body without id is treated as "accepted" |

Plus a live fixture (`fixtures/passcreator/success-create.json`) that
pins the exact response bytes from the 2026-10-12 production push.
A new test (`Passcreator client — live V2 SUCCESS fixture`) reads
the fixture through Vite's `import.meta.glob` and asserts:

1. The fixture's `data.identifier` matches the captured UUID.
2. The client returns `{ id: '<UUID>' }` when fed the captured body.
3. The client surfaces an `upstreamBody` hint pointing at
   `expected data.identifier` when the envelope drops the field.

## Test totals (after fix)

- **Backend**: 586 tests pass (up from 583 — net +3: 1 happy path,
  1 legacy fallback, 1 success-fixture test, with one V2-extraction
  test reshaped)
- **No regression** in any of the 35 other test files.

## Operational follow-ups

| # | Action | Owner |
|---|--------|-------|
| 1 | Re-run the two failed pushes (`85b855a5-...`, `c23e1a46-...`) through the UI — they should now show the success banner | SAOME operator |
| 2 | Confirm `templates.passcreator_template_id` is correctly populated in the DB row for both templates (verify mapping layer wrote the UUID) | SAOME operator |
| 3 | Update the 2026-10-11 docblock's "future fix" reference (now obsolete) | ✅ done in this PR |
| 4 | Add a production smoke-test step to the deploy checklist: after every Step 8 push, curl the same UUID on `GET /api/v2/pass-template/<uuid>` to confirm the upstream has the template | New follow-up |

## Lessons (feed into self-improvement)

1. **Docblock TODOs are technical debt**. The 2026-10-11 note
   "A future fix should align the parser to `data.identifier`" was a
   guaranteed future bug — the next person to ship that doc string
   without changing the parser would have surfaced this regression.
   Recommendation: when a docblock leaves a parser mismatch as a
   tracked action, the next PR that touches the file must resolve
   it (delete the mismatch; the TODO is the spec).
2. **Live fixtures should pin success shapes**, not just error
   shapes. The 2026-10-11 capture script ran 4 hand-crafted failing
   requests but no successful one. Without a captured success
   fixture, the regression had no test case.
3. **Production smoke tests belong in the deploy checklist**.
   The Step 8 path is critical (template persistence upstream is the
   gate to issuing actual passes); a curl-based smoke test that
   pushes a real template and `GET`s it back would have caught
   this in seconds.

## Files touched

| File | Change |
|------|--------|
| `apps/backend/src/shared/lib/passcreator.ts` | Added `extractTemplateId` helper; `createPassTemplate` + `updatePassTemplate` now use it; docblock refreshed to reflect the V2 envelope (no more "future fix" note) |
| `apps/backend/src/shared/lib/passcreator.test.ts` | Happy-path test now exercises V2 envelope; legacy fallback test added; live fixture test added; error-envelope tests updated to use V2 shape where applicable |
| `fixtures/passcreator/success-create.json` | NEW. Live-captured success envelope from the 2026-10-12 production push |
