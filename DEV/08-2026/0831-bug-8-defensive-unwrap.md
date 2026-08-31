# DEV LOG: Bug #8 — Defensive Unwrap of Corrupted settings JSONB (2026-08-31)

## Bug Summary

### Bug #8: Defensive Unwrap of `settings` JSONB Corruption

**Severity**: SEV-3 (non-critical corruption, recoverable)

**Root Cause**: Migration 010 (`20260831000001_010_fix_all_corrupted_settings_arrays.sql`) fixed existing corrupted `settings` arrays in the DB. However, the **root cause was not fixed** — `updateTemplate` still uses `settings = settings || $1::jsonb`, which causes a jsonb array to **grow** (not replace) when applied to an array value.

This means:
1. Migration 010 fixes existing rows
2. User does a new PUT → the `||` operation still corrupts the settings column again (if it's an array)
3. Repeat indefinitely

**Fix Strategy**: Two-layer fix:
- **Layer 1 (done 2026-08-31)**: `updateTemplate` adds a defensive `CASE WHEN jsonb_typeof(settings)` that unwraps any corrupted LHS before applying `||`. This stops future re-corruption regardless of what state the column is in.
- **Layer 2** (done 2026-08-31): Migration 010 fixed existing rows.

## What Was Done

### 1. Added Defensive Unwrap SQL to `updateTemplate`

**File**: `apps/backend/src/modules/cards/db/templates.ts`

**Before** (still corrupting on array LHS):
```sql
settings = settings || $1::jsonb
```

**After** (defensive unwrap):
```sql
settings = CASE jsonb_typeof(settings)
              WHEN 'object' THEN settings
              WHEN 'array'  THEN settings -> -1
              WHEN 'string' THEN (settings #>> '{}')::jsonb
              ELSE settings
            END || $1::jsonb
```

**Why each branch**:
- `WHEN 'object'`: Normal path — settings is a proper JSONB object. Passthrough, then merge.
- `WHEN 'array'`: Corruption from array-growth bug. `settings -> -1` takes the last element (most recent saved state), then merges.
- `WHEN 'string'`: Legacy corruption where the column is a jsonb string (not a jsonb object). `#>> '{}'` extracts the string value, then `::jsonb` casts it.
- `ELSE settings`: Fallback for any other type (null, number, bool). Passthrough, then merge.

### 2. Added Regression Tests

**File**: `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts`

Three new test cases under `describe('updateTemplate — defensive unwrap of corrupted existing settings (Bug #8 / 2026-08-31)')`:

1. `unwraps jsonb array of partial JSON strings before merging` — asserts SQL contains `jsonb_typeof`, `WHEN 'array'`, `settings -> -1`
2. `unwraps jsonb string of partial JSON before merging` — asserts SQL contains `WHEN 'string'`, `#>> '{}'`
3. `preserves object case (normal path still works)` — asserts SQL contains `WHEN 'object'`

Updated 2 existing tests to match new SQL pattern (regex changed from `/settings\s*\|\|/` to `/\|\|/` since LHS is wrapped in CASE WHEN).

### 3. Updated Regex Assertions (Test Fix)

The `||` operator now appears after `END` (not directly after `settings`), so the test regex was updated:
- Old: `expect(setClause).toMatch(/settings\s*\|\|/)`
- New: `expect(setClause).toMatch(/\|\|/)` + `expect(setClause).toMatch(/\$\d+::jsonb/)`

## Test Results

```
✓ src/modules/cards/tests/updateTemplate.merge.test.ts (7 tests) 218ms
✓ Full backend suite: 95 passed | 0 failed | 11 test files
✓ TypeScript: exit 0 (no type errors)
```

## Files Changed

| File | Change |
|------|--------|
| `apps/backend/src/modules/cards/db/templates.ts` | Added defensive CASE WHEN unwrap to `setSettings` |
| `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts` | Added 3 Bug #8 regression tests + updated 2 regex assertions |

## Relation to Other Bugs

- **Bug #1**: Step 3 wipe bug — fixed by Phase 1 (`||` merge instead of `=` replace)
- **Bug #8**: Corruption re-introduction — fixed by defensive CASE WHEN unwrap
- Migration 010 (`20260831000001_010_fix_all_corrupted_settings_arrays.sql`) — fixed existing rows

## Migration Status

- Migration 010 applied 2026-08-31
- Defensive fix in `updateTemplate` applied 2026-08-31
- No further migrations needed
