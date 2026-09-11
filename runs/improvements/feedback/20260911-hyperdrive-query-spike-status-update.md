# Hyperdrive 87% Query Spike Fix — Status Update

> **This file** is a clean ASCII/UTF-8 status update for the Hyperdrive 87% query spike investigation file
> (`runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`).
>
> The original investigation file has mixed-encoding artifacts (Big5 + UTF-8 + replacement chars from earlier
> encoding corruption), so direct text manipulation is risky. This file records the actual state of Phase 1-4
> progress in a clean, machine-parseable format.
>
> **Update date**: 2026-09-11
> **Source commit**: `69d2528 fix(backend): Hyperdrive 87% query spike — Phase 1-4 fix batch`

---

## Phase Status Summary

| Phase | Status | Commit | Description |
|---|---|---|---|
| **Phase 1** | COMPLETED | `69d2528` | `findTenantById` removal from 10 card routes + `getDbForRequest(c)` swap. 11 files, +70/-77 lines |
| **Phase 2** | COMPLETED | `69d2528` | SQL Count Baseline Tests — 13 new tests in 2 files (cards/auth/sql-count-baseline.test.ts) |
| **Phase 3** | COMPLETED | `69d2528` | Structured Log `[sql-count]` middleware — 3 files (sqlCount.ts NEW + client.ts + index.ts) |
| **Phase 4** | PENDING | — | Verification — 24h post-deploy `[sql-count]` query reduction analysis (per §11.6 SOP) |

## Top Consumer Reductions (Expected)

| Rank | Consumer | Before (queries/day) | After Phase 1-3 (expected) | Reduction |
|---|---|---|---|---|
| #1 | Card routes `findTenantById` (10 routes) | ~25,000-40,000 | 0 (JWT tenantId used directly) | 100% |
| #2 | Card routes 2nd `getDb()` warmup | ~10,000-15,000 | 0 (`getDbForRequest(c)` memoized per request) | 100% |
| #3 | Image/logo multi-fetch per user | ~5,000-10,000 | unchanged in this PR | 0% (deferred to Phase 5) |
| #4 | Touch keep-alive | ~4,850 | unchanged | 0% (deferred) |
| #5 | Autosave PUTs | ~1,500 | unchanged | 0% (deferred) |
| #6 | Cron ticks | 1,440 | unchanged | 0% (already fixed by §9) |
| #7 | Auth login/register/refresh | ~1,500 | unchanged | 0% (deferred) |
| — | `/health`, 404s, etc. | ~5,000-10,000 | unchanged | 0% |
| **Total estimated** | **~54,000-83,000** | **~28,000-58,000** | **~30-50%** |

**Note**: Real reduction depends on actual deployment traffic. The `[sql-count]` middleware (Phase 3) provides the
measurement infrastructure to verify.

## Files Changed in Phase 1-3

```
apps/backend/src/modules/cards/routes/
├── create.ts                    (modified: getDbForRequest + remove findTenantById)
├── getById.ts                   (modified: getDbForRequest + remove findTenantById)
├── list.ts                      (modified: getDbForRequest + remove findTenantById)
├── getLatestDraft.ts            (modified: getDbForRequest + remove findTenantById)
├── update.ts                    (modified: getDbForRequest + remove findTenantById)
├── touch.ts                     (modified: getDbForRequest + remove findTenantById)
├── publish.ts                   (modified: getDbForRequest + remove findTenantById)
├── delete.ts                    (modified: getDbForRequest + remove findTenantById)
├── getImage.ts                  (modified: getDbForRequest + remove findTenantById)
└── generate-upload-url.ts       (modified: getDbForRequest + remove findTenantById)

apps/backend/src/shared/middleware/auth.ts         (modified: getDbForRequest + AuthenticatedUser.tenantId)
apps/backend/src/shared/db/client.ts               (modified: getDbForRequest type extension + _queryCounters)
apps/backend/src/shared/middleware/sqlCount.ts     (NEW: structured log middleware)
apps/backend/src/index.ts                          (modified: mount sqlCountMiddleware)

apps/backend/src/modules/cards/tests/sql-count-baseline.test.ts       (NEW: 8 tests)
apps/backend/src/modules/auth/tests/sql-count-baseline.test.ts        (NEW: 5 tests)
```

**Total**: 16 files (12 modified + 4 new in the test/middleware category)

## Verification Results (Local)

| Check | Result |
|---|---|
| `npx tsc -b --noEmit` | exit 0 |
| `npm test` | 225/225 passed (18 test files, including 13 new sql-count-baseline tests) |
| `grep -rn "findTenantById" apps/backend/src/modules/cards/routes/` | 0 hits (was 10) |
| `grep -rn "getDb(c.env.HYPERDRIVE)" apps/backend/src/modules/cards/routes/` | 0 hits (was 10) |
| `grep -rn "findTenantById" apps/backend/src/` | 5 hits (1 def + 4 legit uses in me.ts/refreshService.ts/tenants.ts) |

## Phase 4 — 24h Post-Deploy Verification SOP

Trigger this verification ~24h after the Phase 1-3 commit is deployed to production:

```bash
# Live tail (30-min window)
npx wrangler tail saome-backend --search "[sql-count]" --format pretty

# Or via Cloudflare Dashboard:
# Workers & Pages → saome-backend → Logs → filter "[sql-count]"
```

**Expected per-route queries** (sanity baseline):

| Route | Expected `queries=` |
|---|---|
| `POST /api/cards` | 2 (warmup + INSERT) |
| `GET /api/cards/:id` | 2 (warmup + SELECT) |
| `PUT /api/cards/:id` | 3 (warmup + findTemplate + UPDATE) |
| `GET /api/cards/:id/image/logo` | 2 (warmup + findTemplate — findTenantById removed) |
| `POST /api/auth/refresh` | 3 (isTokenRevoked + findTenantById + getPassStatus, cache-dependent) |
| `GET /api/auth/me` | 2 (isTokenRevoked + findTenantById, cache-dependent) |

If `queries` count exceeds baseline, a refactor has reintroduced a multiplier (e.g. `findTenantById` added back, or
`getDbForRequest` changed back to `getDb()`).

**Decision table** (per §11.6 of investigation file):

| Observed daily total | Decision |
|---|---|
| ~35k/day (60% reduction) | Close out, full success |
| 50-60k/day (40% reduction) | Enter Phase 5 (Option 2 image cache or Option 3 cron bypass) |
| > 70k/day | Revert, find new bug |
| Increased | Revert, find new bug |

## Future Invariants

1. **Card routes MUST NOT** call `findTenantById` — caught by sql-count-baseline test
2. **Card routes MUST** use `getDbForRequest(c)` not `getDb(c.env.HYPERDRIVE)` — code review reject
3. **Don't touch `_queryCounters` WeakMap** — this is the source of truth for `[sql-count]` middleware
4. **Phase 4 verification must use `wrangler tail --search "[sql-count]"`** — not "should reduce"
5. **If Phase 4 shows < 40% reduction** — enter Phase 5, do not continue tweaking this layer

## Related References

- Original investigation file (corrupted encoding, use this status update instead):
  `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`
- JWT tenantId trust decision (root cause upstream of this fix):
  `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`
- Master DEV LOG (also has clean status):
  `DEV/09-2026/0911-hyperdrive-query-spike-fix-master-dev-log.md`
- INDEX entry: `runs/improvements/INDEX.md` (2026-09-11 Phase 1-4 fix entry)
