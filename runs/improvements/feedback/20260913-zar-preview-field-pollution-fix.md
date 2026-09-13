# ZAR Preview Field Pollution Fix — Currency-Aware Display Strings

> **Status**: implemented 2026-09-13, shipped in `dev` member card preview batch
> **Module**: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.tsx`
> **Companion constant**: `packages/shared/constants/cashbackPreviewAmounts.ts`
> **See also**: DEV log `DEV/09-2026/0913-membership-preview-6-fixes.md` (Fix 1-6 master narrative)

---

## TL;DR

The `PassCardPreviewBody.resolveSlot()` helper previously applied a regex-based `R`-prefix
formatter (`/\d+/` → prepend "R") to **every** i18n-sourced preview slot value when
`currency === 'ZAR'`. This contaminated every preview field on every card type:

| Field (key) | Locale value (zh-TW / en) | After ZAR pollution | Correct value |
|---|---|---|---|
| `phone` | `+8869XXXXXXXX` | `R8869XXXXXXXX` | `+8869XXXXXXXX` |
| `birthday` | `05/11/1999` | `R05111999` | `05/11/1999` |
| `visitCount` | `5 次` | `R5` | `5 次` |
| `totalStamps` | `3/{{rows}}` (i18n interp) | `R3` (interpolation broken) | `3/10` |
| `stampsRemaining` | `6個` | `R6` | `6個` |
| `pointsToNextTier` | `123點` | `R123` | `123點` |
| `currentPoints` | `23點` | `R23` | `23點` |
| `pointsToNextTierCashback` | `562元` | `R562` (Han mixed!) | **either** `562元` (TWD) **or** `R562` (ZAR) |
| `accumulatedSpendCashback` | `3301元` | `R3301` (Han mixed!) | **either** `3301元` (TWD) **or** `R3301` (ZAR) |

The last two rows show a **secondary defect**: the formatter mixed Han characters (`元`) into
the ZAR-prefixed string — which would fail the `verify:i18n-keys.mjs` Han-character check
if those strings lived in i18n.

---

## Root Cause

The original implementation tried to be DRY by applying a single regex-based currency
formatter to every preview value:

```ts
// Bad pattern (removed 2026-09-13)
if (currency === 'ZAR') {
  return formatted.replace(/\d+/, (match) => `R${match}`);
}
```

This was wrong for two reasons:

1. **Most fields are currency-agnostic**: phone numbers, birthdays, visit counts, and
   stamp counts have no concept of currency. Adding a currency prefix is meaningless and
   breaks `i18n` interpolation contracts (e.g. `totalStamps` uses `{{rows}}` which the
   formatter mangled).

2. **Cashback amounts ARE currency-driven but the source was wrong**: the formatter
   operated on the i18n string, which means:
   - The TWD value (`562元`) and ZAR value (`R562`) both lived in i18n locale files.
   - To "switch currency" you only needed to flip the regex on/off — but the user would
     still see `562元` for TWD regardless of whether the `R` prefix was applied.
   - Mixed Han/non-Han in the same string (`R562元`) was technically wrong (a Zendesk
     ticket simulator — Brazilian / Japanese tickets would have similar issues).

---

## The Fix

### 1. New shared constant — `packages/shared/constants/cashbackPreviewAmounts.ts`

```ts
export const CASHBACK_PREVIEW_AMOUNTS: Record<
  Currency,
  {
    pointsToNextTierCashback: string;
    accumulatedSpendCashback: string;
  }
> = {
  TWD: {
    pointsToNextTierCashback: '562元',
    accumulatedSpendCashback: '3301元',
  },
  ZAR: {
    pointsToNextTierCashback: 'R562',
    accumulatedSpendCashback: 'R3301',
  },
};
```

Plus a sibling test file `cashbackPreviewAmounts.test.ts` that asserts:

- Currency key exhaustiveness (only `TWD` and `ZAR`)
- No Han characters in ZAR values
- TWD `元` suffix preserved
- Field key set is identical across currencies

### 2. `resolveSlot` loses the regex — `apps/frontend/.../PassCardPreviewBody.tsx`

The default branch now reads `fieldPreview.{key}.value` as-is:

```ts
// Default: read label + value from i18n fieldPreview.{key} verbatim.
// Values are demo data and are NOT currency-dependent (phone numbers,
// names, dates, counts, etc. have no concept of currency), so we do
// NOT apply any ZAR-prefix transformation here. Only the two cashback
// amount fields (handled in the branch above) are currency-driven.
return {
  label: t(`fieldPreview.${field}.label`),
  value: t(`fieldPreview.${field}.value`),
};
```

The two cashback-only display fields (`pointsToNextTierCashback` and
`accumulatedSpendCashback`) read their values from the new constant:

```ts
if (
  field === 'pointsToNextTierCashback' ||
  field === 'accumulatedSpendCashback'
) {
  return {
    label: t(`fieldPreview.${field}.label`),
    value: CASHBACK_PREVIEW_AMOUNTS[currency][field],
  };
}
```

### 3. i18n cleanup — `apps/frontend/src/i18n/locales/passCard.{zh-TW,en}.ts`

The two values moved OUT of i18n and into shared constants. The labels stay
(`pointLabel`, `spendingLabel`) because they ARE locale-specific.

---

## Why This Lives in `packages/shared/constants/` (Rule 023)

Three reasons the new constant goes to `shared/` and NOT to `passCard.i18n.ts`:

1. **Rule 023 § 翻譯書寫紀律**: `passCard.en.ts` may not contain Han characters
   (`verify-i18n-keys.mjs:67` hard-fails CI). Putting `562元` in `passCard.en.ts`
   would fail the audit on every build.

2. **Rule 023 § 業務邏輯在 shared/**: The currency → display-string mapping is
   business-display logic, not locale-specific UI text. The locale-specific part
   (label "到下個層級還差" / "Amount to Next Tier") stays in i18n.

3. **Same value across locales**: `562元` is rendered identically for zh-TW and en
   when `currency === 'TWD'`. i18n would imply it changes per locale, which it
   does NOT — currency, not language, is the discriminator.

---

## Mirrors `BALANCE_PREVIEW_AMOUNTS`

`packages/shared/constants/balancePreview.ts` (added 2026-09-08 for the
balance preview block in `PassCardPreviewHeader`) is the prior art for this
pattern. The cashback amounts follow exactly the same shape:

```
balancePreview.ts           → header balance block (TWD 200元 / ZAR R100)
cashbackPreviewAmounts.ts   → body amount block (TWD 562元 / ZAR R562)
```

Both constants:
- Live in `packages/shared/constants/`
- Are `Record<Currency, ...>` (exhaustive — TypeScript flags missing currencies)
- Use locale-agnostic render values that don't go through i18n translation
- Have sibling test files (5 + 5 cases respectively)

Future invariant: any new field that's currency-driven AND has only locale-stable
values should follow this pattern. Currency-driven fields whose labels DO
localize (e.g. "金額 / Amount") keep their labels in i18n and only move values
to constants.

---

## Verification

| Check | Result |
|---|---|
| `npx tsc -b --noEmit` (workspace) | exit 0 |
| `npm test --workspace=apps/frontend --run PassCardPreviewBody` | all green |
| `npm test --workspace=apps/frontend --run cashbackPreviewAmounts` | 5/5 pass |
| `npm run verify:i18n --workspace=apps/frontend` | 17 namespace(s) passed (34 locale files) |
| Manual inspection: switch cardType across stamp / reward / cashback / membership | No `R` prefix leaks into non-cashback fields |

---

## Future Invariants

1. **No regex-based field formatter allowed in `PassCardPreviewBody`**: the
   `R`-prefix approach is GONE and any new similar prefix logic must follow the
   `currency → shared constant → hard-coded per-currency value` pattern.

2. **`CASHBACK_PREVIEW_AMOUNTS` is the single source** for the two cashback
   amount values. Do NOT recreate them in i18n locale files (will fail
   `verify:i18n-keys.mjs` Han-character check on the `.en` side AND duplicate
   the source of truth).

3. **Adding a new currency** = (a) extend `Currency` zod enum; (b) add entry
   to `CASHBACK_PREVIEW_AMOUNTS`; (c) add entry to `BALANCE_PREVIEW_AMOUNTS`;
   (d) TypeScript will refuse compilation until all four are aligned.

4. **Cashback amount fields stay in `fieldPreview` for labels only**:
   `fieldPreview.pointsToNextTierCashback.label` and `.value.value` are
   distinct — the `.value` string is now in shared constant, the label key
   stays in i18n.

---

## Related References

- DEV log: `DEV/09-2026/0913-membership-preview-6-fixes.md` (6 fixes master narrative)
- Predecessor pattern: `packages/shared/constants/balancePreview.ts` (2026-09-08)
- Module-level contract: `packages/shared/schemas/card.ts::currencySchema`
- Index entry: `runs/improvements/INDEX.md` (2026-09-13 row)
