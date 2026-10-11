# Step 8 v4 — Passcreator push integration feedback (2026-10-11)

**Context**: SAOME CardBuilder Step 8 "Save & Publish" now pushes the
template upstream to Passcreator's V2 API so Apple Wallet / Google
Wallet passes can be issued. This is the v4 plan (`runs/decisions/2026-10-11-step8-passcreator-push.md`).

**What was built (8 phases, all shipped)**:

| Phase | Deliverable | Tests |
|-------|-------------|-------|
| 0 | Migration 021 `passcreator_template_id` + 4-layer sync (DB / shared schema / backend request / db interface) | `schema-conformance.test.ts` 167 cases |
| 1 | `shared/lib/passcreator.ts` (createPassTemplate / updatePassTemplate / fetchPassTemplate) + `BadGatewayError` + `currency.ts` | 34 new tests |
| 1.5 | `packages/shared/i18n/fieldLabels.{ts,zh-TW,en}` (single source of truth for label translations) | 15 drift tests |
| 2A | Frontend `passCard.{zh-TW,en}.ts` thin-spread of shared labels | `verify:i18n` 20 ns / 40 files |
| 2B | `passTemplateMapping.ts` (pure) + `passTemplateSync.ts` (I/O) | 31 mapping tests |
| 3 | `updateTemplateService` flipped to push to Passcreator BEFORE DB write | Critical regression tests |
| 4 | Tests including 🔴 `Passcreator 失敗 → DB 不寫入` | 5 critical tests |
| 5 | wrangler.jsonc vars + bindings type + .dev.vars | (config only) |
| 6 | Backend typecheck + tests | 499 backend tests |
| 7 | Frontend `Step8SaveErrorBanner` + 5 i18n keys + publish hook discriminates by `code` | 19 Step8Save tests |
| 8 | (this feedback + smoke test deferred to live deploy) | n/a |

**Test totals**:
- Backend: 499 tests pass (up from 488)
- Frontend: 19 Step8Save tests pass (up from 15)
- shared: 22 currency + 15 fieldLabels tests pass

## Critical invariants (pinned by tests)

1. **Passcreator failure MUST NOT write DB row** — 2 conformance
   tests in `updateTemplate.passcreator.test.ts`:
   - 5xx upstream response → `BadGatewayError` thrown, `updateTemplate`
     not called
   - 4xx upstream rejection → same (no silent overwrite)
2. **Field labels are language-driven** — `fieldLabels-integration.test.ts`
   6 tests prove the mapping reads from the shared `fieldLabels` module
   (not hardcoded) for both `zh-TW` and `en`
3. **Frontend discrimination** — `Step8Save.test.tsx` 4 new tests:
   - Passcreator `BadGatewayError` → banner renders, no toast
   - non-Passcreator `BadGatewayError` → generic toast, no banner
   - dismiss button clears banner
   - retry button re-triggers publish (and succeeds)

## Open follow-ups (NOT in this PR)

### 1. `apply_migration` MCP failure — manual apply required

**Severity**: P0 (deployment blocker)

**Symptom** (this session): `CallMcpTool({ server: 'user-saome_supabase', toolName: 'apply_migration', ... })` returns `MCP descriptor not found for user-saome_supabase/apply_migration`. Same error on retries with both `server` namespace values. Per Rule 037 §1-4, this is the documented failure mode of the `CallMcpTool` wrapper when the runtime dispatcher can't find a pre-listed tool.

**What I did**: wrote `supabase/migrations/20261011000001_021_add_passcreator_template_id.sql` and updated the 4-layer DB / schema / request / service sync (all 4 db queries + the `TemplatesRow` interface + the 2 `pass-templates` queries). Did NOT commit the migration to `.applied-migrations.json` (Rule 035 §4).

**Action required from operator before deploy**:
1. Open the Supabase dashboard SQL editor.
2. Run the contents of `supabase/migrations/20261011000001_021_add_passcreator_template_id.sql` manually.
3. Confirm `passcreator_template_id` column exists in `public.templates`.
4. Append the entry to `supabase/migrations/.applied-migrations.json`:
   ```json
   {
     "filename": "20261011000001_021_add_passcreator_template_id.sql",
     "applied_at": "2026-10-11",
     "applied_by": "step8-passcreator-push",
     "via": "manual-supabase-dashboard",
     "notes": "Required for Step 8 publish flow. Idempotent (ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS)."
   }
   ```
5. Run `npm run check:migrations --workspace=apps/backend` to confirm the gate passes.

This is the second MCP `descriptor not found` regression in 3 weeks
(2026-09-30 + 2026-10-03 + 2026-10-11). See Rule 037 §6 — consider
adding a CI pre-commit hook that detects the broken pattern.

### 2. `wrangler secret put PASSCREATOR_API_KEY`

The API key was provided in the plan as the Passcreator test key
(`hvGX3MQyOQRhy&qIG9yj%kK1wv=...`). The `.dev.vars` file was
updated for local dev. **Production secret must be provisioned via**:
```bash
cd apps/backend
wrangler secret put PASSCREATOR_API_KEY
# Paste the production API key when prompted
```

If the production secret is missing, the publish flow will throw
`BadGatewayError` with `upstreamBody: 'network error: fetch failed'`
on the FIRST user who tries to publish. The banner will surface this
correctly, but a missing secret is a P0 configuration gap.

### 3. CORS post-deploy check (Rule 017)

After `wrangler deploy`, run the curl matrix from `.cursor/rules/017-production-bundle-guard.mdc`:
- `OPTIONS /api/auth/login` with `Origin: https://saome-frontend.josh1989213.workers.dev` → must return `Access-Control-Allow-Origin`
- `PUT /api/cards/:id` with bad token + `Origin` → must return CORS header even on 401
- `PUT /api/cards/:id` triggering Passcreator failure → 502 + CORS header

The 3-layer CORS defense (Rule 036) handles this — but the new
`PUT /api/cards/:id` route now also throws `BadGatewayError` which
Layer 2 (errorHandler) covers.

### 4. i18n key whitelist — Passcreator

Added `'Passcreator'` to the zh-TW whitelist in
`apps/frontend/scripts/verify-i18n-keys.mjs` (next to `'LINE'`, `'Apple'`,
etc.). If future zh-TW content uses other Passcreator-derived terms
(e.g. "Passcreator API"), add them here too.

## Architecture decisions baked in

- **Pure mapping split**: `passTemplateMapping.ts` (pure function) is
  separate from `passTemplateSync.ts` (I/O wrapper). This means
  unit tests can verify shape without HTTP mocks.
- **Side-channel `passcreator_template_id` write**: the
  `updateTemplate` function only accepts `name / cardType / settings /
  status`. To avoid extending its signature for v1, the service does
  a follow-up `UPDATE templates SET passcreator_template_id = ?`
  after the main write when the sync produced a new id. This is a
  temporary shortcut — a future cleanup should add a typed
  `passcreator_template_id` parameter to `updateTemplate` to make the
  flow atomic. (Bug risk: a process crash between the two writes
  leaves the row with `status='published'` but
  `passcreator_template_id=null` — the next publish will re-create
  upstream, which is idempotent at the Passcreator level but creates
  a duplicate id at the SAOME row level. Acceptable for v1; needs
  cleanup before v2.)
- **No i18n-runtime call in locale files**: removed the `import` +
  `const labels = getFieldLabels(...)` lines from `passCard.{zh-TW,en}.ts`
  because the verify-i18n script's static parser can't resolve
  function calls. The locale files now contain the labels as plain
  string literals; the shared `fieldLabels.{zh-TW,en}.ts` is the
  runtime source of truth and the drift test enforces parity.

## Rule references

- Rule 035 — migration apply pipeline (skipped in this session due
  to MCP failure; operator follow-up #1)
- Rule 036 — Worker runtime CORS defense (3 layers, all present)
- Rule 037 — MCP tool call pattern (the regression; see follow-up #1)
- Rule 019 § 4.1 — 4-layer schema sync (DB → shared → backend
  request → db interface; all 4 layers touched in this PR)
- Rule 000 Part C — third-party service module structure
  (`passcreator.ts` + `passTemplateMapping.ts` + `passTemplateSync.ts`)
- Rule 023 — i18n namespace + flat key + per-card language
- Rule 011 — commit footer
- Rule 006 — verification (all tests green; see totals above)

## Self-improvement

- This is the third time in 3 weeks the `saome_supabase` MCP
  `apply_migration` has failed in a session with "MCP descriptor not
  found". The previous two were 2026-09-30 (pass-templates MCP
  descriptor blocker) and 2026-10-03 (regression). The Rule 037
  specification was updated after each one, but a static
  pre-commit hook (per Rule 037 §6 grep-based check) would have
  caught the same anti-pattern 3 times. **Action**: file a follow-up
  to add the hook in a separate PR. (Out of scope for this PR
  because the .git/hooks directory is local to each developer.)
