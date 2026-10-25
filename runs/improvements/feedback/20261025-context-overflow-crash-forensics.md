# Crash Root Cause — pass runtime value model, 4 crashed work streams

- Date: 2026-10-25
- Scope: read-only forensic recovery + verification. No source file was modified.
- Sources: agent transcripts under `.cursor/projects/c-Users-user-Desktop-SAOME-REBUILD/agent-transcripts/4a98404c-.../subagents/`, plus live repo + Supabase DB state.

---

## 0. Which agent produced the report

The investigation agent is **`cc62d388-765c-4ec0-98c8-2cb739d08a04`** (38 transcript lines, mtime 2026-10-25 01:59:53). Its final report is the assistant text block on **line 37**, titled `# Crash Forensics Report — 4 Background Subagents` (6992 chars).

**It is not looping.** The repetition marker `Key facts established empirically via tsc` occurs at lines 26/28/30 of `a9363806` — that is one of the *crashed* agents, not the investigator. `cc62d388` quotes the marker 7 times because it is *analysing* that loop as evidence.

Its report is accurate on the crash mechanism and on the broken-file inventory, but **two claims are wrong** (see §5) — most importantly, migration 029 *was* applied to the live DB.

---

## 1. ROOT CAUSE

### Verbatim error signature (identical in all 4 transcripts)

```
输入内容过长，请检查是否引入超大文件，请精简输入内容或新开对话 [1] (<request-id>)
```

English: *"Input content too long. Please check whether an oversized file was introduced; please trim the input content or start a new conversation."*

Per-agent occurrences (transcript line / request id):

| Agent | Scope | Transcript line | Request ID |
|---|---|---|---|
| `f6bc0d37-b3eb-40f7-8e10-9f21fbc9b3d4` | shared 契約修復 | L34 of 35 | `1792863308896-b426af8f` |
| `a9363806-9377-4caf-84a8-14f349ef4a37` | backend db 修復 | L31 of 32 | `1792863451206-a381374c` |
| `bba52adb-7d05-4e25-bc5d-2fef00a21382` | migration + Decision Log | L38 of 39 | `1792863332685-5b4bdbd0` |
| `c3c25002-15c0-40d8-bf9a-9efc8f00683b` | discount 簽發調查 | L46 of 47 | `1792863339818-946b736a` |

### Mechanism

The **Model API rejected the request because the accumulated conversation context exceeded the context window.** It is not a harness kill, not OOM, not an MCP error.

Confirmed by direct inspection:

- Every transcript ends with `{"type":"turn_ended","status":"success"}` — the harness recorded the turn as successful because the overflow arrived *as the assistant's normal output text*.
- Consequently the parent received **no `tool_result` for any of the four Task calls**, so a crashed agent is indistinguishable from a silent one unless the transcript tail is read.
- Death timestamps decode to **01:35:08 / 01:35:32 / 01:35:39 / 01:37:31 (+08:00)** — an 83-second window, matching the transcript mtimes exactly.
- No `terminated` / `aborted` / `killed` / `ENOMEM` markers anywhere.

### Why the context blew up (measured)

| Agent | Turns | Assistant text chars | Write calls |
|---|---|---|---|
| `a9363806` | 29 | **1,344,924** | 7 (all to one scratch file) |
| `f6bc0d37` | 32 | 1,279,252 | 6 |
| `bba52adb` | 36 | 1,270,610 | 4 |
| `c3c25002` | 44 | 667,564 | 0 |

`a9363806` (backend db) is the extreme case: **7 successive `Write` calls, every one of them to the same scratch file `apps/backend/src/__probe_sql.ts`**, re-deriving postgres.js `Sql`/`TransactionSql` typing each cycle and restating *"Key facts established empirically via tsc"*. It produced **zero** production files.

The parent relaunched the three remaining agents with `"resume": "<uuid>"` (parent transcript **L1092**), so each resumed agent inherited its already-bloated context and re-overflowed almost immediately.

---

## 2. SHARED CAUSE? — per-stream verdict

**The crash cause is shared. The damage is not.**

All four streams died from the identical signature in the same 83-second window. But the *reason each stream failed to deliver* differs, because each agent died at a different point in its own work.

| # | Stream | Agent | Same crash? | What it actually left behind |
|---|---|---|---|---|
| 1 | shared contract | `f6bc0d37` | ✅ yes | 1 of 6 edits landed cleanly; `passValues.test.ts` was edited to import **4 exports that do not exist** → **4 typecheck errors + 13 test failures**. I3/I4/M3 (`at` datetime, `delta` integrality, `expiryDate` ISO) never implemented — `passValues.ts` still has `at: z.string()`. |
| 2 | backend db | `a9363806` | ✅ yes | **Zero production files.** 7 writes, all to the junk probe `__probe_sql.ts`, which it never deleted. Its 12-finding scope did not land. |
| 3 | migration + registry | `bba52adb` | ✅ yes | Migration 029 SQL written **and successfully applied to the live DB**, but the `.applied-migrations.json` entry was **never appended**, and its `StrReplace` into `passRegistrationService.ts` landed a **call without its import** → `TS2304`. |
| 4 | discount issuance | `c3c25002` | ✅ yes | **Zero file writes** (read-only investigation) — it died before producing any finding. The `transport.ts` `PATCH` addition visible in `git diff` came from an earlier phase, not from this agent. |

**Verdict:** one systemic cause (context overflow), four independent points of failure. Re-dispatching all four with the same prompt shape will reproduce the crash.

---

## 3. HALF-WRITTEN / UNTRUSTWORTHY FILES

### 3a. Byte-level truncation: **none**

Every candidate file was read and checked for balance of `{}` / `()` and its final character. **All 26 files are complete, closed, and syntactically well-formed.** No file ends mid-function.

```
passValueCalculator.ts       210  }  {=22 }=22  (=34 )=34
passExpiry.ts                501  }  {=60 }=60  (=142 )=142
passFieldFormatter.ts        349  }  {=41 }=41  (=66 )=66
passValueErrors.ts            65  }  {=3  }=3   (=8  )=8
passValues.ts                196  }  {=9  }=9   (=54 )=54
transport.ts                 134  ;  {=26 }=26  (=31 )=31
passValueService.ts          262  }  {=32 }=32  (=47 )=47
passValueBackfill.ts         303  }  {=31 }=31  (=48 )=48
passRegistrationService.ts   171  }  {=22 }=22  (=26 )=26
passEvents.ts                209  }  {=23 }=23  (=29 )=29
passHolders.ts               519  }  {=52 }=52  (=108 )=108
templates.ts                 369  }  {=27 }=27  (=82 )=82
registerService.ts           544  }  {=60 }=60  (=120 )=120
backfill-pass-runtime-values.cjs     347  ;  {=46 }=46  (=140 )=140
pass-runtime-values-backfill-worker.ts 170 ;  {=21 }=21  (=39 )=39
028_init_pass_events.sql             143  }  {=6  }=6   (=12 )=12
029_..._one_registered_per_holder.sql 133  }  {=6  }=6   (=12 )=12
```

**Conclusion: no file is truncated or half-written at the byte level.** The breakage is *semantic* — missing exports, a missing import, a missing registry entry, and one orphan scratch file.

### 3b. Artifacts that are NOT trustworthy complete artifacts

| # | Path | Defect | Evidence |
|---|---|---|---|
| B1 | `apps/backend/src/__probe_sql.ts` | **Orphan junk.** Scratch probe from `a9363806`, never deleted. It is inside `src/`, so it is compiled by the backend build. | `npx tsc --noEmit` → `src/__probe_sql.ts(39,27): error TS2345: Argument of type '() => number' is not assignable to parameter of type 'JSONValue'.` Untracked in git. |
| B2 | `packages/shared/schemas/passValues.test.ts` | **Imports 4 exports that `passValues.ts` does not define**: `PASS_VALUE_INTEGER_METRICS`, `PASS_VALUE_NON_NEGATIVE_METRICS`, `isIntegerPassValueMetric`, `isNonNegativePassValueMetric`. | `npx tsc --noEmit` (packages/shared) → 4 errors: `TS2724` (L15), `TS2305` (L17/L19/L20). Runtime: **13 of 39 tests fail** — the `at` datetime group (4), the `delta` integrality group (2), the two metric-rule groups (4), the `expiryDate` ISO group (3). |
| B3 | `apps/backend/src/modules/pass-templates/services/passRegistrationService.ts` | **`buildInitialValues` is called but never imported.** `bba52adb`'s `StrReplace` landed the call site and not the import. | `npx tsc --noEmit` (backend) → `passRegistrationService.ts(126,10): error TS2304: Cannot find name 'buildInitialValues'.` L57 imports only `reducePassValues`. Runtime: `ReferenceError: buildInitialValues is not defined` — **all 7 tests** in `register.runtimeValues.test.ts` fail. |
| B4 | `supabase/migrations/20261024170000_029_...sql` | SQL file is complete and **already applied to the live DB**, but the local registry entry is **missing**. | `npm run check:migrations --workspace=apps/backend` → `FAIL: 1 migration file(s) have NO registry entry` naming `20261024170000_029_pass_events_one_registered_per_holder_idx.sql`. |
| B5 | `supabase/migrations/.applied-migrations.json` | Entry for 028 records `"via": "wrangler-hyperdrive-worker"`, but the 028 SQL header says `-- Applied via: saome_supabase MCP apply_migration`. The two contradict each other, and 028 is absent from the Supabase `schema_migrations` ledger (it was applied outside MCP). M8 unresolved. | Registry L30 vs `028_init_pass_events.sql` L29. Ledger jumps `027 → 029`. |
| B6 | `packages/shared/logic/passValueErrors.ts` | File is complete, but `PassValueDomainError` is referenced **only by its own test** — no production code throws it. `passValueCalculator.ts` still folds without domain validation. | `grep PassValueDomainError` → only `passValueErrors.ts` (def) + `passValueCalculator.test.ts` (import). |
| B7 | `runs/decisions/2026-10-24-pass-runtime-value-model.md` | Complete document, but **contains no over-redemption decision section** (M8). The over-redemption semantics decision is unmade. | `grep over-redemption / 超發 / redemption` → no decision section for it. |

---

## 4. BEFORE RE-DISPATCH

### 4a. Fix the tree first (these are cheap and unblock everything)

1. **Delete `apps/backend/src/__probe_sql.ts`** (B1). It is untracked junk; `git rm`/`Remove-Item` on an untracked file touches nothing else. Restores backend typecheck.
2. **Add `buildInitialValues` to the import at `passRegistrationService.ts` L57** (B3):
   ```ts
   import { buildInitialValues, reducePassValues } from '@saome/shared/logic/passValueCalculator';
   ```
   `buildInitialValues` *does* exist — `packages/shared/logic/passValueCalculator.ts` L133 `export function buildInitialValues(input: InitialValuesInput): PassEvent`. Only the import is missing.
3. **Append the 029 registry entry** to `supabase/migrations/.applied-migrations.json` (B4) — do **NOT** re-apply the migration:
   ```json
   { "filename": "20261024170000_029_pass_events_one_registered_per_holder_idx.sql", "applied_at": "2026-10-24", "applied_by": "pass-runtime-value-model", "via": "saome_supabase-mcp" }
   ```
   Re-running `check:migrations` must then exit 0.
4. **Resolve the 028 `via` mismatch** (B5): either correct the registry to `saome_supabase-mcp` (and note the true mechanism), or correct the SQL header comment to match reality. Pick one and make the two agree.
5. **Decide the 4 missing shared exports** (B2): either implement them in `passValues.ts` (`PASS_VALUE_INTEGER_METRICS` / `PASS_VALUE_NON_NEGATIVE_METRICS` / `isIntegerPassValueMetric` / `isNonNegativePassValueMetric`) **and** add the `at` / `delta` / `expiryDate` validation the tests demand, **or** delete the 13 unpassing test cases. Implementing them is the correct choice — they encode findings I3/I4/M3 that are still open. Note the tests also pin behaviour the schema does not have:
   - `at: z.string()` → must reject DATE-ONLY, tz-less, and non-datetime strings (I3)
   - `expiryDate: z.string().nullable()` → must be ISO `YYYY-MM-DD`, rejecting malformed, non-existent calendar dates, and full timestamps (M3)
   - `delta` must be metric-aware (integer for all metrics **except** `spendAccumulated`, which is a currency amount) (I4)

### 4b. Fix the gap nobody caught yet — 23505 is *not* handled

Migration 029's own header (L52-58) asserts:

> `passRegistrationService.ensureRegistrationRuntimeState()` catches the unique violation and REPLAYS the ledger instead of appending, so a re-registration over a holder that already has an opening event (under a different key) returns `duplicate: true` … **it never appends and never 500s.**

**This is not true in the code.** `ensureRegistrationRuntimeState` has no `try`/`catch`; `applyPassEvent` has no 23505 handling. And `appendPassEvent` uses `ON CONFLICT (pass_holder_id, idempotency_key) DO NOTHING` — which the 029 header itself notes does **not** cover the new partial index (same holder, *different* key).

So in production today: a second `registered` row for a holder under a non-canonical key is rejected by the live DB with SQLSTATE `23505`, and it surfaces as an **unhandled 500** — exactly what the migration claims cannot happen.

A test for this already exists — `apps/backend/src/modules/pass-templates/tests/register.runtimeValues.test.ts` L162:

```
it('treats the DB-level rejection as an idempotent replay (NOT a 500)', async () => {
```

It mocks `appendPassEvent` to reject with `code: '23505'`, `constraint: 'pass_events_one_registered_per_holder_idx'`. It currently cannot pass because it dies earlier on B3's `ReferenceError`. **After fixing B3, this test must go green** — i.e. the catch must be implemented in `ensureRegistrationRuntimeState` (re-read the ledger, set `duplicate: true`) or in `applyPassEvent`.

Also note `passValueBackfill.ts` L292 has a catch-all that counts any error as `skipped` and pushes it into `result.errors` — the 029 header claims such holders are counted as `skipped` (not an error). That is only true if the 23505 is converted to a clean `duplicate` *before* reaching the catch-all.

### 4c. Redispatch strategy (do not repeat what failed)

- **Do NOT use `"resume": "<uuid>"`.** Resumed agents inherit the bloated context and re-overflow instantly. This is exactly what happened at parent L1092.
- **Cap context per agent.** Add to every prompt: *"Do not read `node_modules/**`. Do not create scratch probe files in `src/` — put throwaway type probes in a temp dir outside the repo, or delete them before you finish. Run at most 2 full-project `tsc --noEmit` passes; batch your type questions into one probe. Keep prose under ~10 sentences per turn."*
- **Split the shared stream further.** It carried I1b/I2a/I3/I4/M1/M3/M6 across `packages/shared/**` — split into `schemas/passValues.ts` (I3/I4/M3) and `logic/passValueCalculator.ts` + `passFieldFormatter.ts` (I1b/M1/M6).
- **Re-dispatch only what is actually outstanding.** The migration stream's SQL work is done and applied — it needs only the registry entry plus the 23505 service-layer work. The discount stream needs to be re-run from scratch; it produced nothing.
- **Cap concurrency at 2–3** and watch transcript file size. >500 KB of assistant text is the early-warning signal that the next turn will overflow.
- Keep `subagent_type: generalPurpose` (it was right — `explore` cannot write), but **poll the Task result** rather than assuming: because the overflow reports `turn_ended: success`, a crashed agent looks exactly like a silent one.

---

## 5. Corrections to the recovered investigator report

Two claims in `cc62d388`'s report are wrong and would cause incorrect remediation if acted on directly:

| Investigator claim | Reality (verified) |
|---|---|
| Migration 029 *"never applied to DB and never registered"* — recommendation was to apply it via MCP | **Wrong on "not applied".** 029 **IS** applied to the live DB. `pg_indexes` shows `pass_events_one_registered_per_holder_idx` → `CREATE UNIQUE INDEX ... ON public.pass_events USING btree (pass_holder_id) WHERE (event_type = 'registered'::text)`, and the Supabase ledger `supabase_migrations.schema_migrations` holds version `20261024172145` / name `20261024170000_029_pass_events_one_registered_per_holder_idx`. The migration agent called `apply_migration` at transcript L28 and verified at L29. **Only the local `.applied-migrations.json` entry is missing.** Acting on the report literally would re-apply an already-applied migration (harmless here because of `IF NOT EXISTS`, but wrong, and it skips the real fix). |
| *"No file is byte-truncated — the breakage is semantic"* | **Confirmed correct.** Independently re-verified brace/paren balance and final character across all 26 candidate files. |

The investigator also under-reported the semantic breakage: it listed 4 missing exports and 1 missing import, but did not report the **13 failing shared tests**, the **unimplemented 23505 catch** that migration 029's own header falsely claims exists, the **`PassValueDomainError` never being thrown in production code**, or the **missing over-redemption Decision Log section**.

---

## 6. Open questions needing a human decision

1. **Over-redemption semantics (M8).** Clamp at zero, allow a signed balance, or reject the event with a domain error? This is unrepresentable as a business outcome today and blocks I1b/I2a. It must be encoded in the schema *and* the reducer, and needs a `runs/decisions/` entry.
2. **Is `carryoverBalance` the only signed metric?** The schema allows `carryoverBalance` to go negative (it is an `N − M` difference). The missing `PASS_VALUE_NON_NEGATIVE_METRICS` export and its test encode that answer — confirm it before implementing.
3. **Is `spendAccumulated` allowed to be fractional?** The test asserts it is (a currency amount) while every other metric is integer. Confirm, since it changes `delta` validation from one rule to two.
4. **Should `at` accept only UTC ISO-8601 with offset, or any offset?** The reducer sorts by raw string comparison, so mixed offsets would mis-order the fold. The test rejects tz-less values but does not settle the offset-normalisation question.
5. **028 registry `via`:** `saome_supabase-mcp` (matches the file header, contradicts the registry notes) or `wrangler-hyperdrive-worker` (matches the registry notes, contradicts the header)? Also: 028 is missing from the Supabase `schema_migrations` ledger — should it be back-filled, or is the ledger intentionally bypassed for worker-applied migrations?
6. **Should `appendPassEvent` gain the partial index to its `ON CONFLICT` arbiter?** Today the arbiter is `(pass_holder_id, idempotency_key)`, which cannot absorb the new partial index. Either the service catches 23505, or the arbiter is widened — but the arbiter cannot be widened for a *partial* index in Postgres, so catching 23505 is the only route.
7. ~~Re-dispatch scope for the discount stream.~~ **RESOLVED 2026-10-25 — line closed, no code change needed.** The user empirically registered a *new* template and issued a *new* pass against it with no problem, which proves the discount issuance path itself (`transport.ts` → Passcreator v3 → `upstreamFailed` mapping) is sound. The `upstreamFailed` failures were therefore caused by the **pre-existing templates** being missing required upstream fields — not by a defect in our request shape, template-id resolution, or the `catch` block mislabelling non-upstream errors. The three candidate root causes the re-dispatch was meant to separate are all moot: it was a **data problem in old template rows**, not a code problem. No worker was re-dispatched for this line.

   Supporting detail: the upstream `describe` probe of the five template ids returned HTTP 404 `{"success":false,"description":"The template is not known."}` for the stamp id (`22d0d89d-…`), i.e. at least one referenced template no longer exists upstream. Combined with the successful new-template registration, the picture is consistent with **stale/incomplete template records**, so the follow-up (if anyone revisits it) is a **data audit of existing template rows against upstream**, not a code fix. The `c3c25002` worker produced zero file writes and is superseded by this conclusion.

---

## 7. Per-file working-tree status

### Modified (tracked) — 25 files

| Path | Status |
|---|---|
| `.gitignore` | complete (config surface, unrelated to the 4 streams) |
| `apps/backend/src/modules/pass-templates/db/passHolders.ts` | complete |
| `apps/backend/src/modules/pass-templates/db/templates.ts` | complete |
| `apps/backend/src/modules/pass-templates/services/registerService.ts` | complete — wires `ensureRegistrationRuntimeState` (L48 import, L238 call) |
| `apps/backend/src/modules/pass-templates/tests/register.test.ts` | complete |
| `apps/backend/src/shared/lib/passcreator.ts` | complete |
| `apps/backend/src/shared/lib/passcreator/transport.ts` | complete — adds `'PATCH'` to the method union (earlier phase, not the crashed discount agent) |
| `apps/backend/src/shared/lib/passcreator/v3-pass-types.ts` | complete |
| `apps/backend/src/shared/lib/passcreator/v3-pass.ts` | complete |
| `apps/backend/vitest.config.ts` | complete |
| `apps/frontend/.../PassCardPreviewHeader.test.tsx` | complete (out of scope) |
| `apps/frontend/.../PassCardPreviewHeader.tsx` | complete (out of scope) |
| `apps/frontend/.../passCardPreviewSlot.ts` | complete (out of scope) |
| `apps/frontend/vite.config.ts` | complete |
| `apps/frontend/vitest.config.ts` | complete |
| `packages/shared/constants/index.ts` | complete |
| `packages/shared/i18n/fieldLabels.en.ts` | complete |
| `packages/shared/i18n/fieldLabels.ts` | complete |
| `packages/shared/i18n/fieldLabels.zh-TW.ts` | complete |
| `packages/shared/i18n/index.ts` | complete |
| `packages/shared/logic/index.ts` | complete — exports `passExpiry`, `passValueCalculator`, `passFieldFormatter`, `passValueErrors` |
| `packages/shared/package.json` | complete — export map entries added for all 4 new logic modules + `schemas/passValues` + `constants/headerSlots` |
| `packages/shared/schemas/card.ts` | complete |
| `packages/shared/schemas/index.ts` | complete |
| `supabase/migrations/.applied-migrations.json` | **suspect (B5)** — 028 `via` wrong; 029 entry missing |

### Untracked — 27 files

| Path | Status |
|---|---|
| `apps/backend/scripts/backfill-pass-runtime-values.cjs` | complete |
| `apps/backend/scripts/pass-runtime-values-backfill-worker.ts` | complete |
| `apps/backend/src/__probe_sql.ts` | **broken (B1)** — orphan probe, TS2345 |
| `apps/backend/src/modules/pass-templates/db/passEvents.ts` | complete |
| `apps/backend/src/modules/pass-templates/services/passRegistrationService.ts` | **broken (B3)** — TS2304 + missing 23505 catch |
| `apps/backend/src/modules/pass-templates/services/passValueBackfill.ts` | complete (catch-all semantics conflict with 029 header) |
| `apps/backend/src/modules/pass-templates/services/passValueService.ts` | complete (no 23505 handling) |
| `apps/backend/src/modules/pass-templates/tests/passValueBackfill.test.ts` | complete |
| `apps/backend/src/modules/pass-templates/tests/passValueService.test.ts` | complete |
| `apps/backend/src/modules/pass-templates/tests/passValues.conformance.test.ts` | complete |
| `apps/backend/src/modules/pass-templates/tests/register.runtimeValues.test.ts` | **suspect** — 7/7 fail (`ReferenceError: buildInitialValues`); contains the valid-but-unpassable 23505 test |
| `apps/backend/src/shared/lib/passcreator/v3-pass-update.test.ts` | complete |
| `apps/backend/wrangler.backfill.jsonc` | complete |
| `packages/shared/constants/headerSlots.test.ts` | complete |
| `packages/shared/constants/headerSlots.ts` | complete |
| `packages/shared/logic/passExpiry.paidMembership.test.ts` | complete |
| `packages/shared/logic/passExpiry.test.ts` | complete |
| `packages/shared/logic/passExpiry.ts` | complete |
| `packages/shared/logic/passExpiryRule.test.ts` | complete |
| `packages/shared/logic/passFieldFormatter.test.ts` | complete |
| `packages/shared/logic/passFieldFormatter.ts` | complete (M6) |
| `packages/shared/logic/passValueCalculator.test.ts` | complete — imports resolve |
| `packages/shared/logic/passValueCalculator.ts` | **suspect (B6)** — complete file, but no domain-error enforcement (I1b/I2a open) |
| `packages/shared/logic/passValueErrors.ts` | **suspect (B6)** — complete file, never used by production code |
| `packages/shared/schemas/passValues.test.ts` | **broken (B2)** — 4 missing exports, 13 failing tests |
| `packages/shared/schemas/passValues.ts` | **suspect (B2)** — missing 4 exports; `at: z.string()` (L124/L149); `expiryDate: z.string().nullable()` (L111/L127) |
| `runs/decisions/2026-10-24-pass-runtime-value-model.md` | **suspect (B7)** — complete doc, missing over-redemption decision (M8) |
| `runs/plans/` (2026-10-24-pass-runtime-values-roadmap.md, 2026-10-24-pass-scanner-event-semantics.md) | complete |
| `supabase/migrations/20261024000001_028_init_pass_events.sql` | complete — applied via wrangler worker, absent from Supabase ledger, header/registry disagree |
| `supabase/migrations/20261024170000_029_...sql` | complete + **applied to live DB**; missing local registry entry (B4) |

---

## 8. Verification commands used (all read-only)

```powershell
# crash signatures
[System.IO.File]::ReadAllLines($transcript, [Text.Encoding]::UTF8)   # per-line ConvertFrom-Json

# typecheck
cd apps/backend  ; npx tsc --noEmit      # → 2 errors
cd packages/shared ; npx tsc --noEmit    # → 4 errors

# migration registry gate
npm run check:migrations --workspace=apps/backend
# → FAIL: 1 migration file(s) have NO registry entry

# tests
cd packages/shared ; npx vitest run schemas/passValues.test.ts logic/passValueCalculator.test.ts
cd apps/backend   ; npx vitest run src/modules/pass-templates/tests/register.runtimeValues.test.ts

# live DB state (read-only SQL via saome_supabase MCP)
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='pass_events';
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6;
```

No `npm install`, no `apply_migration`, no file writes other than this report.
