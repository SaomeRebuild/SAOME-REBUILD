/**
 * Currency formatting — shared between web and React Native.
 *
 * @module shared/logic/currency
 * @description Locale-aware money formatting for the SAOME reward / coupon /
 * discount / cashback templates. The Passcreator push pipeline reads from
 * this module to render currency strings (e.g. rewardValue / couponDiscount /
 * monthlyCost) inside `backFields`, so preview and deployed pass stay in sync.
 *
 * Conventions:
 *   - Input is a plain number (not a string) — caller is responsible for
 *     validating it's a finite number before invoking.
 *   - NaN / Infinity inputs return '—' as a defensive fallback (display,
 *     never compute). Rationale: the editor schema validates ≥ 0 / positive
 *     at write-time, but a leftover / corrupted row could still surface NaN.
 *   - The two default-app currencies get hand-tuned formatting per the design
 *     system (TWD = `NT$1,000`, ZAR = `R10` — note the **no space** between
 *     prefix and digits, and no `.00` fractional part). All other currencies
 *     fall through to `Intl.NumberFormat` which produces a CC-appropriate
 *     output (e.g. USD = `$10.00`, JPY = `¥1,000`).
 *
 * Rule references:
 *   - Rule 023 § Shared Validation 用 i18n Key — currency errors are i18n
 *     keys (`currency.error.invalidNumber`), not raw strings.
 *   - Rule 019 § D.3 — this module is the canonical source for currency
 *     formatting; the backend mapping module mirrors it (no divergent
 *     formatters).
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md (plan)
 */

/**
 * Supported currency codes for SAOME templates.
 *
 * SAOME currently ships TWD (Taiwan) and ZAR (South Africa) as the two
 * production regions. The schema is the source of truth (see
 * `shared/schemas/card/::currencySchema`); this list mirrors that.
 * If you add a code here, add it to the schema AND the i18n locale
 * exports in the same PR (Rule 019 § 4.1 quad-binding).
 */
export type CurrencyCode = 'TWD' | 'ZAR' | 'USD' | 'JPY' | 'EUR';

/**
 * Result of `formatCurrency`:
 *   - on success: `{ formatted: string }`
 *   - on invalid input: `{ error: { type: 'invalid', message: <i18n key> } }`
 *
 * Callers discriminate via `'formatted' in result` (matches the pattern
 * from `shared/logic/color.ts::validateColor`).
 */
export type FormatCurrencyResult =
  | { formatted: string }
  | { error: { type: 'invalid'; message: string } };

const INVALID_NUMBER_KEY = 'currency.error.invalidNumber';

/**
 * Check whether a number is safe to format (finite, not NaN).
 *
 * Exposed as a public helper so the editor's store setters can short-circuit
 * before pushing invalid values into the autosave pipeline. Bundle-safe (no
 * external imports).
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Format a currency amount per locale-aware rules.
 *
 * Behavior:
 *   - TWD → `NT${amount.toLocaleString('en-US')}` (e.g. `NT$1,000`).
 *     Design decision (2026-10-11): Taiwan uses no decimal cents on retail
 *     pricing surfaces. Manual separator avoids the `Intl` quirk that renders
 *     `NT$1,000.00` for `style: 'currency'`.
 *   - ZAR → `R${amount.toLocaleString('en-US')}` — same rational (no
 *     fractional cents on consumer-facing surfaces; ZAR amounts are
 *     typically whole-rand in loyalty programs).
 *   - USD → `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
 *     → `$10.00`. Standard format.
 *   - JPY → `Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })`
 *     → `¥1,000`. Note: JPY has no fractional digits by ISO 4217.
 *   - EUR → `Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })`
 *     → `€10.00`. en-IE uses a comma thousands separator (vs. `.` in
 *     en-US-only output) — the [design-system] preference for the
 *     SAOME consumer-facing surfaces.
 *
 * Invalid input (NaN / Infinity / undefined / non-number):
 *   Returns `{ error: { type: 'invalid', message: 'currency.error.invalidNumber' } }`.
 *   Callers should resolve the i18n key via `t()` and render a placeholder.
 *   We do NOT silent-render `'NaN'` or `'$0.00'` — silent zeros are user-
 *   confusing (looks like "you owe nothing" in a reward context).
 *
 * @param amount   — number to format. Plain JS number.
 * @param currency — one of `CurrencyCode`. Defaults to `'TWD'`.
 * @returns         — `FormatCurrencyResult`.
 *
 * @example
 *   formatCurrency(1000, 'TWD')      // { formatted: 'NT$1,000' }
 *   formatCurrency(10, 'ZAR')        // { formatted: 'R10' }
 *   formatCurrency(10, 'USD')        // { formatted: '$10.00' }
 *   formatCurrency(NaN, 'TWD')       // { error: { type: 'invalid', message: 'currency.error.invalidNumber' } }
 */
export function formatCurrency(
  amount: unknown,
  currency: CurrencyCode = 'TWD',
): FormatCurrencyResult {
  if (!isFiniteNumber(amount)) {
    return { error: { type: 'invalid', message: INVALID_NUMBER_KEY } };
  }

  switch (currency) {
    case 'TWD':
      // Manual formatter — Intl.currency adds `.00` we don't want.
      // Math.round drops fractional parts (retail convention for TWD).
      return { formatted: `NT$${Math.round(amount).toLocaleString('en-US')}` };
    case 'ZAR':
      // ZAR uses 'R' prefix with **no space** (per design token 2026-10-11).
      // Math.round drops fractional parts (consumer pricing convention).
      return { formatted: `R${Math.round(amount).toLocaleString('en-US')}` };
    case 'USD':
      return {
        formatted: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount),
      };
    case 'JPY':
      // Intl with maximumFractionDigits=0 because JPY has no minor unit.
      return {
        formatted: new Intl.NumberFormat('ja-JP', {
          style: 'currency',
          currency: 'JPY',
          maximumFractionDigits: 0,
        }).format(amount),
      };
    case 'EUR':
      return {
        formatted: new Intl.NumberFormat('en-IE', {
          style: 'currency',
          currency: 'EUR',
        }).format(amount),
      };
    default: {
      // Exhaustiveness check via the return type — TS will surface
      // a compile error here if a new currency code is added without
      // a case branch above. We intentionally don't throw at runtime
      // (the function returns a valid result either way), but the
      // return type of `default:` is `never`, so any path that falls
      // through here is a compile-time error.
      return { error: { type: 'invalid', message: INVALID_NUMBER_KEY } };
    }
  }
}

/**
 * Convenience that swallows the error branch and returns a fallback string.
 *
 * Use this in JSX surface code where you would rather render `—` than handle
 * an error tuple. Pure view function — never persist the result to DB.
 *
 * @example
 *   formatCurrencyOrFallback(NaN, 'TWD')  // '—'
 *   formatCurrencyOrFallback(1000, 'TWD') // 'NT$1,000'
 */
export function formatCurrencyOrFallback(
  amount: unknown,
  currency: CurrencyCode = 'TWD',
  fallback = '—',
): string {
  const result = formatCurrency(amount, currency);
  return 'formatted' in result ? result.formatted : fallback;
}
