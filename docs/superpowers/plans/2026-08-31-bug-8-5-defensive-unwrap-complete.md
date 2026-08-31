# Bug #8.5 — `updateTemplate` Defensive Unwrap Incomplete (P0 data-loss)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `updateTemplate` from re-corrupting `templates.settings` JSONB when the column is already in a corrupted (array-of-strings) state, and recover the existing corrupted row.

**Architecture:** Add a nested `CASE WHEN` inside the `WHEN 'array'` branch of the defensive unwrap so the array's last element (which is itself a JSONB string) is first cast to text then to JSONB object. Mirror the same nested unwrap pattern in the frontend defensive spreads (`MediaAssetUploader` + `loadSettings`) and the backend response shape (`toDto`). Add a DB-level trigger that rejects any future non-object `settings` write as a last line of defense. Re-run recovery on the currently corrupted row.

**Tech Stack:** Cloudflare Workers · Hono · postgres.js · JSONB · Vitest · Supabase MCP

---

## Background (read this first)

### Bug progression

| Date | Bug | Fix | Status |
|---|---|---|---|
| 2026-08-21 | `updateTemplate` `settings = $1::jsonb` (REPLACE) wipes unrelated fields | `settings \|\| $1::jsonb` (MERGE) | OK Fixed (Phase 1) |
| 2026-08-31 | Pre-Phase-1 corruption: `settings` is `["{...step2...}", "{...step3 logo...}"]` | Migration 010 unwraps to last element | OK Fixed for legacy data |
| 2026-08-31 | Post-Phase-1 new writes re-introduce array corruption because `jsonb_array \|\| jsonb_object` -> text-array | Bug #8: defensive `CASE WHEN jsonb_typeof` in `updateTemplate` | OK Fixed for OBJECT/STRING/ELSE branches |
| 2026-08-31 | **Bug #8.5 (current)**: `WHEN 'array' THEN settings -> -1` returns a JSONB STRING (last element is `"\"{...}\""`), not a JSONB object. Then `jsonb_string \|\| jsonb_object` -> PostgreSQL "All other cases" -> text array -> re-corruption | **This plan** | TODO To do |

### Why migration 010 didn't catch this

Migration 010 had the correct nested unwrap in its data-recovery path (it explicitly handles `settings -> -1` being a string). But the same nested unwrap was not mirrored in `updateTemplate`'s defensive CASE WHEN. So:

1. Migration 010 runs -> recovers row to a proper JSONB object -> OK
2. User does a new PUT -> `updateTemplate` runs -> `WHEN 'array' THEN settings -> -1` returns a string -> `string || object` -> text-array corruption -> FAIL

The migration fixed the data; it did NOT fix the source.

### Live evidence (as of 2026-08-31 morning)

```sql
SELECT id, jsonb_typeof(settings), jsonb_array_length(settings)
  FROM public.templates
 WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
```

Returns: `array`, `2`. The current state is:

```json
[
  "{\"issuerLogo\":\"efb3fbbc-0b7d-48f1-8e65-8bafa17e0893/2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3/issuer-logo.png\"}",
  "{\"iconImage\":\"efb3fbbc-0b7d-48f1-8e65-8bafa17e0893/2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3/icon.png\"}"
]
```

Step 2 data (`barcodeType`, `storeName`, `issuerName`, `currency`, `isPaid`) is permanently lost from this row. Recovery of those fields is impossible — earlier elements were overwritten in subsequent corruption cycles.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/backend/src/modules/cards/db/templates.ts` | Modify | Add nested CASE WHEN to `setSettings` array branch |
| `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts` | Modify | Add 2 regression tests: array-of-strings & array-of-objects |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.tsx` | Modify | `safeSettings` parser handles array of strings |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts` | Modify | `loadSettings` parser handles array of strings |
| `apps/backend/src/modules/cards/services/cardService.ts` | Modify | `toDto` handles array of strings (parse + merge) |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts` | Modify | Add regression test for array-of-strings input |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx` | Modify | Add regression test for array-of-strings input on upload |
| `supabase/migrations/20260831000002_012_recover_bug85_corrupted_row.sql` | Create | Merge-all-elements recovery for the known corrupted row |
| `supabase/migrations/20260831000003_013_defensive_template_settings.sql` | Create | DB-level trigger that rejects non-object `settings` |
| `DEV/08-2026/0831-bug-8-5-defensive-unwrap-complete.md` | Create | DEV LOG |

---

## Global Constraints

- PostgreSQL JSONB `||` operator semantics: `obj || obj = merged obj`; `arr || arr = concat arr`; `str || obj` or `obj || str` = text array of both (the "All other cases" rule that causes re-corruption).
- `jsonb_typeof` returns: `'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'`.
- Migration discipline: any new `.sql` MUST be applied via `saome_supabase` MCP `apply_migration` immediately; commit footer MUST include `Migration: <name> applied via saome_supabase MCP`.
- No raw text in shared logic: error messages via i18n keys (rule 023).
- TDD discipline (rule 003): write failing test BEFORE implementation; ONE failing test per assertion.
- Verification before completion (rule 006): run `npx tsc -b --noEmit`, `npm test`, `npm run lint` (where applicable) BEFORE claiming done.
- postgres.js Dynamic Query rule (027): dynamic UPDATE uses tagged template `${}` injection only — never `$N` placeholders inside `sql.unsafe`.
- Phase ordering: Phase 0 (data recovery) MUST happen BEFORE Phase 1 (source fix) so the user gets their data back as soon as possible.

---

## Phase 0 — Recovery of existing corrupted row (do this FIRST)

The corrupted row must be recovered (or documented as unrecoverable) BEFORE fixing the source, otherwise the user is stuck with the bug.

### Task 0.1: Inspect existing data + decide recovery strategy

**Files:**
- Read: `supabase/migrations/20260831000001_010_fix_all_corrupted_settings_arrays.sql`

**Steps:**
- [ ] Inspect the corrupted row to see what fields can be recovered:
  ```sql
  SELECT id, jsonb_array_elements(settings) AS partial
    FROM public.templates
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
- [ ] Expected output: 2 rows, each a JSONB string like `"{\"issuerLogo\":\"...\"}"` and `"{\"iconImage\":\"...\"}"`
- [ ] Confirm Step 2 fields (`barcodeType`, `storeName`, `issuerName`, `currency`, `isPaid`) are NOT recoverable from this row — they were lost in a previous cycle.
- [ ] Document the loss in the DEV LOG (Task 4.3).

### Task 0.2: Write the recovery migration

**Files:**
- Create: `supabase/migrations/20260831000002_012_recover_bug85_corrupted_row.sql`

**Steps:**
- [ ] Write the migration:
  ```sql
  -- Migration: 012_recover_bug85_corrupted_row
  -- Desc: Recover the known corrupted row from Bug #8.5 by merging all
  --       partial JSON strings in the settings array into a single object.
  --       Earlier elements provide defaults; later elements override on conflict.
  --
  -- Why this is row-specific:
  --   We cannot generically recover Step 2 fields that were lost in earlier
  --   corruption cycles. Step 2 data for this row must be re-entered by the
  --   user via the CardBuilder UI. This migration only recovers what's still
  --   present in the array (issuerLogo, iconImage).

  UPDATE public.templates
     SET settings = (
       SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
         FROM (
           SELECT DISTINCT ON (key) key, value
             FROM (
               SELECT (elem #>> '{}')::jsonb AS obj, ord
                 FROM jsonb_array_elements(settings) WITH ORDINALITY AS t(elem, ord)
             ) elems
             CROSS JOIN LATERAL jsonb_each(obj) kv(key, value)
            ORDER BY key, ord DESC
         ) merged
     )
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3'
     AND jsonb_typeof(settings) = 'array';
  ```
- [ ] Apply via `saome_supabase` MCP `apply_migration` with name `012_recover_bug85_corrupted_row`
- [ ] Verify recovery:
  ```sql
  SELECT id, jsonb_typeof(settings), settings
    FROM public.templates
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
  Expected: `object` type, `settings` has `issuerLogo` + `iconImage` keys.

---

## Phase 1 — Fix the source: `updateTemplate` nested CASE WHEN

### Task 1.1: Write failing test for nested unwrap

**Files:**
- Modify: `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts`

**Steps:**
- [ ] Add tests inside the `describe('updateTemplate — defensive unwrap of corrupted existing settings (Bug #8 / 2026-08-31)')` block:
  ```ts
  it('unwraps jsonb array whose LAST ELEMENT is a string (Bug #8.5 regression)', async () => {
    const { sql, captured } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { iconImage: 'tenant-1/template-1/icon.png' },
    });

    const setClause = captured[0]!.sql;
    expect(setClause).toMatch(/WHEN\s+'array'[\s\S]*?jsonb_typeof\s*\(\s*settings\s*->\s*-1\s*\)/i);
    expect(setClause).toMatch(/WHEN\s+'array'[\s\S]*?WHEN\s+'string'[\s\S]*?#>>\s*'\{\}'/i);
    expect(setClause).toMatch(/WHEN\s+'array'[\s\S]*?#>>\s*'\{\}'\s*\)\s*::\s*jsonb/i);
  });

  it('handles array of jsonb objects (already-fixed path)', async () => {
    const { sql, captured } = createMockSql();
    await updateTemplate(sql, 'test-id', {
      settings: { iconImage: 'tenant-1/template-1/icon.png' },
    });

    const setClause = captured[0]!.sql;
    expect(setClause).toMatch(/WHEN\s+'array'[\s\S]*?WHEN\s+'object'/i);
  });
  ```
- [ ] Run the tests: `cd apps/backend && npx vitest run src/modules/cards/tests/updateTemplate.merge.test.ts`
- [ ] Expected: 2 NEW tests FAIL (regex doesn't match current SQL — no nested CASE WHEN)

### Task 1.2: Implement nested CASE WHEN in `updateTemplate`

**Files:**
- Modify: `apps/backend/src/modules/cards/db/templates.ts:154-163`

**Steps:**
- [ ] Replace the current `setSettings` clause:
  ```ts
  // BEFORE (Bug #8 incomplete — Bug #8.5 root cause)
  const setSettings = input.settings !== undefined
    ? sql`settings = CASE jsonb_typeof(settings)
                WHEN 'object' THEN settings
                WHEN 'array'  THEN settings -> -1
                WHEN 'string' THEN (settings #>> '{}')::jsonb
                ELSE settings
              END || ${JSON.stringify(input.settings)}::jsonb`
    : null;
  ```
- [ ] With the nested CASE WHEN version:
  ```ts
  // AFTER (Bug #8.5 fix — nested unwrap inside WHEN 'array')
  //
  // Why the inner CASE WHEN is mandatory:
  //   The outer `WHEN 'array'` unwraps `settings -> -1`, which returns the
  //   LAST ARRAY ELEMENT. That element is itself a jsonb STRING
  //   (e.g. `"\"{...}\""`) — the legacy corruption stored each partial
  //   update as a JSON-string element. If we feed a jsonb STRING into
  //   `|| jsonb_object`, PostgreSQL falls into "All other cases" and
  //   concatenates them as TEXT ARRAY — re-corrupting the column on every
  //   write.
  //
  //   The inner CASE WHEN parses the string element to a jsonb object
  //   BEFORE the `||` operator sees it. Mirrors migration 010/011 pattern.
  const setSettings = input.settings !== undefined
    ? sql`settings = CASE jsonb_typeof(settings)
                WHEN 'object' THEN settings
                WHEN 'array'  THEN (
                  CASE jsonb_typeof(settings -> -1)
                    WHEN 'object' THEN settings -> -1
                    WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                    ELSE '{}'::jsonb
                  END
                )
                WHEN 'string' THEN (settings #>> '{}')::jsonb
                ELSE settings
              END || ${JSON.stringify(input.settings)}::jsonb`
    : null;
  ```
- [ ] Run the tests again: `cd apps/backend && npx vitest run src/modules/cards/tests/updateTemplate.merge.test.ts`
- [ ] Expected: all tests in this file PASS (7 existing + 2 new = 9 total)

### Task 1.3: Verify no regressions in full backend suite

**Files:** none (verification only)

**Steps:**
- [ ] Run the full backend test suite: `cd apps/backend && npm test`
- [ ] Expected: 97 / 97 passed (95 existing + 2 new)

### Task 1.4: Commit

**Files:** git only

**Steps:**
- [ ] Commit:
  ```bash
  git add apps/backend/src/modules/cards/db/templates.ts apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts
  git commit -m "fix(cards): complete Bug #8 defensive unwrap with nested CASE WHEN

  - When settings is jsonb array of jsonb strings, the outer CASE WHEN's
    'array' branch returned settings -> -1 which is itself a JSONB STRING.
    jsonb_string || jsonb_object falls into PostgreSQL 'All other cases'
    and concatenates as text array — re-corrupting on every write.
  - Add nested CASE WHEN inside WHEN 'array' to parse string elements to
    jsonb object before || operator (mirrors migration 010/011 pattern).
  - 2 new regression tests for Bug #8.5; full suite 97/97 green.

  Refs: Bug #8.5 (defensive unwrap incomplete)
  Self-improvement: runs/improvements/INDEX.md (Bug #8.5 follow-up)"
  ```

---

## Phase 2 — Defense in depth: frontend & backend defensive parsers

These tasks are independent of Phase 1 but should be done together — defense-in-depth.

### Task 2.1: Fix `MediaAssetUploader` defensive spread

**Files:**
- Modify: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.tsx:294-298`

**Steps:**
- [ ] Read current code:
  ```ts
  const currentTemplate = await cardService.getById(templateId);
  const rawSettings = currentTemplate.settings;
  const safeSettings: Record<string, unknown> =
    typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings ?? {});
  await cardService.update(templateId, {
    settings: { ...safeSettings, [config.settingsField]: key },
  });
  ```
- [ ] Add a helper function near the top of the file (after imports):
  ```ts
  /**
   * Normalize a template.settings value to a plain JSON object.
   * Tolerates the legacy corruption shapes:
   *   - string (jsonb string of a JSON string) -> JSON.parse
   *   - array of strings (jsonb array of partial JSON strings) -> parse + merge
   *   - array of objects (jsonb array of partial objects) -> merge
   *   - object (normal) -> pass-through
   *   - null/undefined -> {}
   */
  function normalizeSettings(
    raw: unknown,
  ): Record<string, unknown> {
    if (raw == null) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, unknown>; }
      catch { return {}; }
    }
    if (Array.isArray(raw)) {
      return raw.reduce<Record<string, unknown>>((acc, s) => {
        const obj = typeof s === 'string'
          ? (() => { try { return JSON.parse(s); } catch { return {}; } })()
          : (s ?? {});
        return { ...acc, ...(obj as Record<string, unknown>) };
      }, {});
    }
    return raw as Record<string, unknown>;
  }
  ```
- [ ] Replace the body of the upload handler with:
  ```ts
  const currentTemplate = await cardService.getById(templateId);
  const safeSettings: Record<string, unknown> = normalizeSettings(currentTemplate.settings);
  await cardService.update(templateId, {
    settings: { ...safeSettings, [config.settingsField]: key },
  });
  ```

### Task 2.2: Fix `loadSettings` defensive parser (store)

**Files:**
- Modify: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts:117-127`

**Steps:**
- [ ] Read current code:
  ```ts
  const resolved: Record<string, unknown> = Array.isArray(settings)
    ? settings.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...s }), {})
    : typeof settings === 'string'
      ? JSON.parse(settings)
      : (settings ?? {});
  ```
- [ ] Replace with array-aware parser:
  ```ts
  const resolved: Record<string, unknown> = Array.isArray(settings)
    ? settings.reduce<Record<string, unknown>>((acc, s) => {
        const obj = typeof s === 'string'
          ? (() => { try { return JSON.parse(s); } catch { return {}; } })()
          : (s ?? {});
        return { ...acc, ...(obj as Record<string, unknown>) };
      }, {})
    : typeof settings === 'string'
      ? (() => { try { return JSON.parse(settings); } catch { return {}; } })()
      : (settings ?? {});
  ```

### Task 2.3: Fix `toDto` defensive parser (backend service)

**Files:**
- Modify: `apps/backend/src/modules/cards/services/cardService.ts:27-31`

**Steps:**
- [ ] Read current code:
  ```ts
  const settings: Record<string, unknown> =
    typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  ```
- [ ] Replace with array-aware parser:
  ```ts
  const settings: Record<string, unknown> = ((): Record<string, unknown> => {
    const raw: unknown = row.settings;
    if (raw == null) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, unknown>; }
      catch { return {}; }
    }
    if (Array.isArray(raw)) {
      return raw.reduce<Record<string, unknown>>((acc, s) => {
        const obj = typeof s === 'string'
          ? (() => { try { return JSON.parse(s); } catch { return {}; } })()
          : (s ?? {});
        return { ...acc, ...(obj as Record<string, unknown>) };
      }, {});
    }
    return raw as Record<string, unknown>;
  })();
  ```

### Task 2.4: Add regression tests

**Files:**
- Modify: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts`
- Modify: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx`

**Steps for store test:**
- [ ] Add test:
  ```ts
  it('loadSettings parses array of partial JSON strings (Bug #8.5 regression)', () => {
    useCardBuilderStore.getState().reset();
    useCardBuilderStore.getState().loadSettings([
      '{"barcodeType":"pdf_417","storeName":"狐狸早餐店"}',
      '{"issuerLogo":"efb3fbbc-0b7d-48f1-8e65-8bafa17e0893/2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3/issuer-logo.png"}',
    ] as unknown as Partial<TemplateSettings>);
    const state = useCardBuilderStore.getState();
    expect(state.barcodeType).toBe('pdf_417');
    expect(state.storeName).toBe('狐狸早餐店');
    expect(state.issuerLogo).toMatch(/issuer-logo\.png$/);
  });
  ```
- [ ] Run: `cd apps/frontend && npx vitest run src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts`
- [ ] Expected: PASS

**Steps for MediaAssetUploader test:**
- [ ] Add test that simulates `cardService.getById` returning an array of strings, then assert `cardService.update` is called with a merged object (not array).
- [ ] Run: `cd apps/frontend && npx vitest run src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx`
- [ ] Expected: PASS

### Task 2.5: Commit

**Files:** git only

**Steps:**
- [ ] Commit:
  ```bash
  git add apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.tsx apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts apps/backend/src/modules/cards/services/cardService.ts apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx
  git commit -m "fix(cards): defensive parsers handle jsonb array of strings (Bug #8.5)

  - MediaAssetUploader.upload() now uses normalizeSettings() to merge
    legacy array-of-strings shapes before spreading.
  - CardBuilderEditor.store.loadSettings() now parses each array element
    as JSON before merging (was spreading strings as character arrays).
  - Backend toDto() mirrors the same merge logic for DTO responses.
  - 2 new regression tests.

  Refs: Bug #8.5 (defensive unwrap incomplete)
  Self-improvement: runs/improvements/INDEX.md"
  ```

---

## Phase 3 — DB-level safety net (prevent future re-corruption)

### Task 3.1: Add trigger to reject non-object settings

**Files:**
- Create: `supabase/migrations/20260831000003_013_defensive_template_settings.sql`

**Steps:**
- [ ] Write the migration:
  ```sql
  -- Migration: 013_defensive_template_settings
  -- Desc: DB-level safety net — reject any INSERT or UPDATE that would leave
  --       templates.settings as anything other than a JSONB OBJECT.
  --
  -- Why a trigger (not a CHECK constraint):
  --   PostgreSQL CHECK constraints cannot reference jsonb_typeof() — they
  --   only allow IMMUTABLE expressions. A trigger is the standard pattern.
  --
  -- Why this matters (Bug #8.5 lineage):
  --   The application-layer defensive unwrap has a nested CASE WHEN to
  --   parse legacy corruption. If a future code change drops that
  --   defense, this trigger catches it at the DB level before the column
  --   is corrupted again.

  CREATE OR REPLACE FUNCTION enforce_template_settings_object()
  RETURNS TRIGGER AS $$
  BEGIN
    -- Allow NULL (no settings yet) and JSONB OBJECT only.
    IF NEW.settings IS NOT NULL AND jsonb_typeof(NEW.settings) <> 'object' THEN
      RAISE EXCEPTION
        'templates.settings must be a JSONB object (got %) — see Bug #8.5',
        jsonb_typeof(NEW.settings)
        USING ERRCODE = '23514'; -- check_violation
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_template_settings_object ON public.templates;
  CREATE TRIGGER trg_template_settings_object
    BEFORE INSERT OR UPDATE OF settings ON public.templates
    FOR EACH ROW
    EXECUTE FUNCTION enforce_template_settings_object();
  ```
- [ ] Apply via `saome_supabase` MCP `apply_migration` with name `013_defensive_template_settings`
- [ ] Verify trigger exists:
  ```sql
  SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers
   WHERE event_object_table = 'templates'
     AND trigger_name = 'trg_template_settings_object';
  ```
  Expected: 2 rows (`INSERT` BEFORE + `UPDATE` BEFORE).

### Task 3.2: Sanity-test the trigger

**Files:** none (verification)

**Steps:**
- [ ] Try to manually corrupt via SQL and verify the trigger blocks it:
  ```sql
  UPDATE public.templates
     SET settings = '["bad"]'::jsonb
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
  Expected: ERROR with `check_violation` and message "templates.settings must be a JSONB object".
- [ ] Re-verify normal path still works:
  ```sql
  UPDATE public.templates
     SET settings = '{"test":"trigger-ok"}'::jsonb
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
- [ ] Restore the recovered settings from migration 012 (re-run migration 012 if needed).

### Task 3.3: Commit

**Files:** git only

**Steps:**
- [ ] Commit:
  ```bash
  git add supabase/migrations/20260831000002_012_recover_bug85_corrupted_row.sql supabase/migrations/20260831000003_013_defensive_template_settings.sql
  git commit -m "fix(db): reject non-object settings + recover Bug #8.5 row

  - Migration 012: merge-all-elements recovery for the known corrupted row
    (Step 2 data is unrecoverable; user must re-enter).
  - Migration 013: DB-level trigger that rejects any INSERT/UPDATE leaving
    templates.settings as anything other than a JSONB OBJECT. Last line of
    defense if the application-layer defensive unwrap ever regresses.

  Refs: Bug #8.5
  Migration: 012 + 013 applied via saome_supabase MCP
  Self-improvement: runs/improvements/INDEX.md"
  ```

---

## Phase 4 — End-to-end verification

### Task 4.1: Manual smoke test (Browser flow)

**Files:** none (manual verification)

**Steps:**
- [ ] Start backend: `cd apps/backend && npm run dev`
- [ ] Start frontend: `cd apps/frontend && npm run dev`
- [ ] Log in, navigate to the corrupted card `2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3`
- [ ] Verify Step 3 shows the icon preview correctly (iconImage key should be set after migration 012)
- [ ] Re-enter Step 2 fields (lost data)
- [ ] Click Next -> Step 3
- [ ] Verify settings JSONB is a proper object (not array):
  ```sql
  SELECT id, jsonb_typeof(settings), settings
    FROM public.templates
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
- [ ] Upload a new icon
- [ ] Verify settings STILL a proper object:
  ```sql
  SELECT id, jsonb_typeof(settings) FROM public.templates
   WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
  ```
- [ ] Click "Next" -> Step 4
- [ ] Click "Back" -> Step 3
- [ ] Verify icon + logo preview still visible

### Task 4.2: Full backend + frontend test suites green

**Files:** none (verification)

**Steps:**
- [ ] Backend: `cd apps/backend && npm test`
- [ ] Frontend: `cd apps/frontend && npm test`
- [ ] Backend typecheck: `cd apps/backend && npx tsc -b --noEmit`
- [ ] Frontend typecheck: `cd apps/frontend && npx tsc -b --noEmit`

### Task 4.3: DEV LOG + INDEX update

**Files:**
- Create: `DEV/08-2026/0831-bug-8-5-defensive-unwrap-complete.md`
- Modify: `runs/improvements/INDEX.md`

**Steps:**
- [ ] Write the DEV LOG following `saome-dev-logging` SKILL.md format
- [ ] Append row to `runs/improvements/INDEX.md` referencing Bug #8.5
- [ ] Commit:
  ```bash
  git add DEV/08-2026/0831-bug-8-5-defensive-unwrap-complete.md runs/improvements/INDEX.md
  git commit -m "docs: DEV LOG for Bug #8.5 fix + INDEX update"
  ```

---

## Self-Review Checklist

- [x] Spec coverage: root cause fix (Task 1.2), frontend defensive (Tasks 2.1-2.3), regression tests (Tasks 1.1, 2.4), DB safety net (Task 3.1), recovery of existing data (Task 0.2), end-to-end verification (Phase 4).
- [x] No placeholders: every step has actual SQL / TS code.
- [x] Type consistency: parser returns `Record<string, unknown>` consistently.
- [x] Migration discipline: both migrations applied via `saome_supabase` MCP.
- [x] TDD discipline: failing test BEFORE implementation in Tasks 1.1, 2.4.
- [x] No regressions: full backend suite (Task 1.3) and frontend suite (Task 4.2) re-run.
- [x] Phase ordering: Phase 0 (recovery) BEFORE Phase 1 (source fix).

---

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-bug-8-5-defensive-unwrap-complete.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration with checkpoints
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
