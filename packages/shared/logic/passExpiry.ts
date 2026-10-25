/**
 * Pass expiry rules — one place that decides a card's expiry date.
 *
 * @module shared/logic/passExpiry
 * @description Resolves the three expiry shapes SAOME supports into a
 * single ISO `YYYY-MM-DD` date (or `null` for "never expires").
 *
 *   - `never`          → the card does not expire
 *   - `duration_days`  → expires N days after issuance
 *   - `specific_date`  → expires on a fixed calendar date
 *
 * WHY A NEW MODULE (and not the existing `calculateExpirationDate`)
 *
 * `packages/shared/logic/pass.ts::calculateExpirationDate(startDate,
 * durationDays): Date` looks like it would fit, but it does not:
 *
 *   1. It is DEAD CODE — zero callers anywhere in the repo. It has
 *      never been exercised, so it has never been verified against a
 *      real expiry case.
 *   2. It returns a `Date` OBJECT. A runtime value must be
 *      JSON-serializable (it goes into `pass_events.payload` and
 *      `pass_values_snapshot` as JSONB), and a `Date` silently becomes
 *      an ISO *timestamp* string when JSON-serialized — which drags a
 *      timezone into a value that is conceptually a calendar date.
 *   3. It only handles `duration_days`. Membership, coupon and
 *      discount cards each have their own expiry shape, and the
 *      template's `settings` already stores them in three different
 *      field layouts.
 *
 * TIMEZONE SAFETY (the important part)
 *
 * The expiry is a BUSINESS DATE, not an instant. "Valid until
 * 2027-10-23" means the end of the 23rd in the tenant's local time —
 * it must NOT shift because the server runs in UTC, or because the
 * browser is in a different timezone than the backend.
 *
 * The implementation therefore:
 *   - does all date arithmetic on `YYYY-MM-DD` strings, never on
 *     `Date` objects;
 *   - anchors "today" to a caller-supplied calendar date (the
 *     backend passes the issuance date), so the function is pure and
 *     testable;
 *   - returns a `YYYY-MM-DD` string, never a `Date`.
 *
 * Rule references:
 *   - Rule 023 § Shared Package 邊界 — pure business logic in shared.
 *   - Rule 024 § Mobile Future-Proof — no `Date`, no platform API.
 *
 * @see packages/shared/logic/passValueCalculator.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md § 決定六
 */

/**
 * The three expiry shapes SAOME supports.
 */
export type PassExpiryMode =
  /** The card never expires. */
  | 'never'
  /** The card expires N days after issuance. */
  | 'duration_days'
  /** The card expires N months after issuance (calendar-correct). */
  | 'duration_months'
  /** The card expires on a fixed calendar date. */
  | 'specific_date';

/**
 * A resolved expiry rule.
 *
 * The mode names match the persisted template setting names
 * (`membershipExpiryMode` uses `custom_days` / `specific_date`; this
 * module renames `custom_days` → `duration_days` so the vocabulary is
 * consistent across all three card types).
 */
export interface PassExpiryRule {
  mode: PassExpiryMode;
  /**
   * Days after issuance. Only meaningful for `duration_days`.
   * Must be a positive integer.
   */
  durationDays?: number | null;
  /**
   * Months after issuance. Only meaningful for `duration_months`.
   * Must be a positive integer.
   *
   * This mode exists because a PAID membership's expiry is "1 month"
   * or "1 year" from the registration date — and "1 month" is NOT
   * "30 days". Converting it to days would expire a Jan-31
   * subscription on Mar-2 (or Feb-28 in a leap year): off by a day
   * or two, and different every month. Calendar-correct month
   * arithmetic is the only correct answer.
   */
  durationMonths?: number | null;
  /**
   * The fixed expiry date, ISO `YYYY-MM-DD`. Only meaningful for
   * `specific_date`.
   */
  specificDate?: string | null;
}

/**
 * A `YYYY-MM-DD` calendar date.
 */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the string is a syntactically valid ISO calendar date.
 *
 * Checks the shape AND that the date actually exists (e.g.
 * `2026-02-30` is rejected — it would silently roll over to March 2
 * if we ever parsed it with `new Date()`).
 */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map((n) => Number.parseInt(n, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Day-of-month check via a UTC Date (no timezone involved: we use
  // the UTC getters and construct with Date.UTC, so the round-trip
  // cannot drift).
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Parse a `YYYY-MM-DD` string into its numeric parts.
 *
 * @throws when the string is not a valid calendar date.
 */
function parts(isoDate: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map((n) => Number.parseInt(n, 10));
  return { year: year!, month: month!, day: day! };
}

/**
 * Format numeric date parts back to `YYYY-MM-DD`.
 */
function format(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Add `days` to a calendar date.
 *
 * Pure calendar arithmetic: it uses `Date.UTC` purely as a day-number
 * calculator and then reads the result back with the UTC getters, so
 * no timezone can shift the outcome.
 *
 * @example
 *   addDays('2026-10-23', 1)   // '2026-10-24'
 *   addDays('2026-12-31', 1)   // '2027-01-01'
 *   addDays('2024-02-28', 1)   // '2024-02-29'  (leap year)
 */
export function addDays(isoDate: IsoDate, days: number): IsoDate {
  const { year, month, day } = parts(isoDate);
  const base = Date.UTC(year, month - 1, day);
  const shifted = new Date(base + days * 24 * 60 * 60 * 1000);
  return format(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/**
 * Add `months` to a calendar date.
 *
 * Calendar-correct: the result keeps the same DAY-OF-MONTH, clamped
 * to the last day of a shorter target month.
 *
 * @example
 *   addMonths('2026-10-23', 1)   // '2026-11-23'
 *   addMonths('2026-01-31', 1)   // '2026-02-28'  (clamped)
 *   addMonths('2024-01-31', 1)   // '2024-02-29'  (leap year)
 *   addMonths('2026-01-31', 12)  // '2027-01-31'  (one year)
 *
 * Why this is NOT `addDays(date, months * 30)`: a monthly
 * subscription must expire on the same day-of-month it started. The
 * 30-day approximation drifts by up to 11 days per year and lands
 * on a different day every month.
 */
export function addMonths(isoDate: IsoDate, months: number): IsoDate {
  const { year, month, day } = parts(isoDate);

  // Shift the month, carrying the year over.
  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = zeroBased - Math.floor(zeroBased / 12) * 12; // 0-based

  // Clamp the day to the last day of the target month. `Date.UTC`
  // rolls over automatically, so we probe with day 0 of the NEXT
  // month to learn the target month's length.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return format(targetYear, targetMonth + 1, clampedDay);
}

/**
 * Resolve an expiry rule into a concrete calendar date.
 *
 * @param rule     The expiry shape + parameters.
 * @param issuedOn The issuance date (ISO `YYYY-MM-DD`) — the anchor
 *                  for `duration_days` / `duration_months`.
 * @returns The expiry date (ISO `YYYY-MM-DD`), or `null` when the card
 *          never expires.
 *
 * Behaviour on invalid input — deliberately forgiving, because the
 * expiry comes from a tenant-authored template setting and a broken
 * template must not break a holder's registration:
 *
 *   - `mode: 'never'`               → `null`
 *   - `duration_days` with a
 *     missing / non-positive /
 *     non-integer day count         → `null` (treated as "no expiry")
 *   - `duration_months` with a
 *     missing / non-positive /
 *     non-integer month count       → `null` (treated as "no expiry")
 *   - `specific_date` with a
 *     missing / malformed date      → `null` (treated as "no expiry")
 *
 * Returning `null` means "this card has no expiry" — a safe, visible
 * state. The alternative (throwing) would turn a typo in a template
 * setting into a failed registration for every holder of that
 * template.
 */
export function resolveExpiryDate(
  rule: PassExpiryRule,
  issuedOn: IsoDate,
): IsoDate | null {
  if (rule.mode === 'never') return null;

  if (rule.mode === 'duration_days') {
    const days = rule.durationDays;
    if (
      typeof days !== 'number' ||
      !Number.isFinite(days) ||
      !Number.isInteger(days) ||
      days <= 0
    ) {
      return null;
    }
    if (!isIsoDate(issuedOn)) return null;
    return addDays(issuedOn, days);
  }

  if (rule.mode === 'duration_months') {
    const months = rule.durationMonths;
    if (
      typeof months !== 'number' ||
      !Number.isFinite(months) ||
      !Number.isInteger(months) ||
      months <= 0
    ) {
      return null;
    }
    if (!isIsoDate(issuedOn)) return null;
    return addMonths(issuedOn, months);
  }

  // mode === 'specific_date'
  const specific = rule.specificDate;
  if (!isIsoDate(specific)) return null;
  return specific;
}

/**
 * The expiry rule for a membership card.
 *
 * Membership cards have a card-wide `hasExpiry` toggle. When it is
 * off, the card never expires (lifetime membership). When it is on,
 * the expiry comes from ONE of two places, depending on whether the
 * card is paid or free:
 *
 *   - FREE membership → the card-level trio (`expiryMode` +
 *     `customExpiryDays` / `specificExpiryDate`).
 *   - PAID membership → the PER-TIER duration the holder bought
 *     (`durationType`: `monthly` → +1 month, `yearly` → +1 year).
 *
 * The paid tier duration comes from the HOLDER's frozen tier
 * snapshot, not from the template — a template can offer a monthly
 * AND a yearly tier simultaneously, and only the holder's purchase
 * decides when THEIR pass expires.
 *
 * When the free rule is set it takes PRECEDENCE over the tier
 * duration: it is the rule the editor renders for a free card, and a
 * template that somehow carries both is mid-edit — the free rule is
 * the one the tenant actually configured.
 *
 * @param hasExpiry            The card-wide expiry toggle.
 * @param expiryMode           `custom_days` | `specific_date` | null.
 * @param customExpiryDays     Days, when `expiryMode === 'custom_days'`.
 * @param specificExpiryDate   ISO date, when `expiryMode === 'specific_date'`.
 * @param durationType         The PAID holder's tier duration.
 */
export function membershipExpiryRule(args: {
  hasExpiry?: boolean | null;
  expiryMode?: 'custom_days' | 'specific_date' | null;
  customExpiryDays?: number | null;
  specificExpiryDate?: string | null;
  durationType?: 'monthly' | 'yearly' | null;
}): PassExpiryRule {
  if (args.hasExpiry !== true) {
    return { mode: 'never' };
  }
  if (args.expiryMode === 'custom_days') {
    return { mode: 'duration_days', durationDays: args.customExpiryDays ?? null };
  }
  if (args.expiryMode === 'specific_date') {
    return { mode: 'specific_date', specificDate: args.specificExpiryDate ?? null };
  }
  // PAID membership: the tier duration decides. 1 monthly tier → +1
  // month; 1 yearly tier → +12 months.
  if (args.durationType === 'monthly') {
    return { mode: 'duration_months', durationMonths: 1 };
  }
  if (args.durationType === 'yearly') {
    return { mode: 'duration_months', durationMonths: 12 };
  }
  // hasExpiry=true but no mode AND no tier — the template is mid-edit
  // (or the holder never completed their purchase).
  return { mode: 'never' };
}

/**
 * Read the paid-membership duration from a holder's frozen tier
 * snapshot.
 *
 * The snapshot (`pass_holders.membership_tier_snapshot`, JSONB) is the
 * authoritative record of what the holder bought. It is read
 * DEFENSIVELY — the column is free-form JSONB, so a malformed value
 * must degrade to "no duration" (→ never expires) rather than throw
 * inside a registration flow.
 *
 * @param snapshot - The raw JSONB value (`unknown`).
 * @returns         - `'monthly'` | `'yearly'` | `null`.
 */
export function membershipDurationTypeFromSnapshot(
  snapshot: unknown,
): 'monthly' | 'yearly' | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;
  const durationType = (snapshot as { durationType?: unknown }).durationType;
  if (durationType === 'monthly' || durationType === 'yearly') {
    return durationType;
  }
  return null;
}

/**
 * The expiry rule for a coupon card.
 *
 * Coupon cards use the card-level Step 2 fields: `passValidDays`
 * (duration) or `expiryDate` (specific). When both are set, the
 * duration wins — that matches the editor preview's branch order
 * (`passCardPreviewSlot.ts::computeCouponExpiryValue`).
 */
export function couponExpiryRule(args: {
  passValidDays?: number | null;
  expiryDate?: string | null;
}): PassExpiryRule {
  if (args.passValidDays !== null && args.passValidDays !== undefined) {
    return { mode: 'duration_days', durationDays: args.passValidDays };
  }
  if (isIsoDate(args.expiryDate)) {
    return { mode: 'specific_date', specificDate: args.expiryDate };
  }
  return { mode: 'never' };
}

/**
 * The expiry rule for a discount card.
 *
 * Discount cards use the Step 6 fields: `discountCustomExpiryDays`
 * (duration) or `discountSpecificExpiryDate` (specific). The two are
 * mutually exclusive in the editor; when both are somehow set, the
 * duration wins — matching the editor preview's branch order.
 */
export function discountExpiryRule(args: {
  customExpiryDays?: number | null;
  specificExpiryDate?: string | null;
}): PassExpiryRule {
  if (args.customExpiryDays !== null && args.customExpiryDays !== undefined) {
    return { mode: 'duration_days', durationDays: args.customExpiryDays };
  }
  if (isIsoDate(args.specificExpiryDate)) {
    return { mode: 'specific_date', specificDate: args.specificExpiryDate };
  }
  return { mode: 'never' };
}

/**
 * The subset of template settings the expiry rules read.
 *
 * Kept structural (not a zod-inferred type) so this module stays a
 * pure function that both the backend and React Native can call with a
 * plain object — and so a future settings rename is caught by the
 * compiler at the CALL SITE rather than silently ignored here.
 */
export interface PassTemplateExpirySettings {
  /** Membership card-wide expiry toggle. */
  hasExpiry?: boolean | null;
  /** Free-membership expiry mode. */
  membershipExpiryMode?: 'custom_days' | 'specific_date' | null;
  /** Free-membership custom day count. */
  membershipCustomExpiryDays?: number | null;
  /** Free-membership fixed expiry date (ISO `YYYY-MM-DD`). */
  membershipSpecificExpiryDate?: string | null;
  /** Coupon card duration (Step 2). */
  passValidDays?: number | null;
  /** Coupon card fixed expiry date (Step 2). */
  expiryDate?: string | null;
  /** Discount card custom day count (Step 6). */
  discountCustomExpiryDays?: number | null;
  /** Discount card fixed expiry date (Step 6). */
  discountSpecificExpiryDate?: string | null;
}

/**
 * The holder-specific context the expiry rules may need.
 *
 * Only ONE field today — the paid-membership tier duration — but the
 * parameter is an object (not a bare string) so a second
 * holder-dependent rule can be added without changing every call
 * site's signature again.
 */
export interface PassHolderExpiryContext {
  /**
   * The PAID membership tier duration the holder bought
   * (`monthly` / `yearly`), read from their frozen tier snapshot.
   *
   * `null` / omitted means "the holder has no paid tier" (a free
   * membership, or a purchase that never completed).
   */
  durationType?: 'monthly' | 'yearly' | null;
}

/**
 * Resolve the expiry rule for a template, from its card type + settings.
 *
 * This is the ONE place that knows which settings feed which card
 * type's expiry. The backend calls it during issuance; the editor
 * preview has its own display formatting (a locale-aware string) but
 * reads the SAME settings, so the two cannot disagree about WHICH
 * date a card expires on.
 *
 * Card-type coverage:
 *   - `membership_card` → the free-membership expiry trio
 *     (`hasExpiry` + `membershipExpiryMode` + days / date), OR the
 *     PAID holder's tier duration (`context.durationType`).
 *   - `coupon_card`     → `passValidDays` / `expiryDate`.
 *   - `discount_card`   → `discountCustomExpiryDays` /
 *     `discountSpecificExpiryDate`.
 *   - everything else   → never expires (stamp / reward / cashback /
 *     multipass / gift have no expiry concept).
 *
 * Defensive by design: an unusable setting degrades to "never
 * expires" rather than throwing, because a broken template must not
 * break every holder's registration.
 *
 * @param cardType - The template's card type.
 * @param settings - The template's settings (the expiry-relevant subset).
 * @param context  - Holder-specific context (the paid tier duration).
 */
export function resolveExpiryRuleForCardType(
  cardType: string | null | undefined,
  settings: PassTemplateExpirySettings | null | undefined,
  context?: PassHolderExpiryContext | null,
): PassExpiryRule {
  if (!cardType || !settings) return { mode: 'never' };

  switch (cardType) {
    case 'membership_card':
      return membershipExpiryRule({
        hasExpiry: settings.hasExpiry,
        expiryMode: settings.membershipExpiryMode,
        customExpiryDays: settings.membershipCustomExpiryDays,
        specificExpiryDate: settings.membershipSpecificExpiryDate,
        durationType: context?.durationType ?? null,
      });
    case 'coupon_card':
      return couponExpiryRule({
        passValidDays: settings.passValidDays,
        expiryDate: settings.expiryDate,
      });
    case 'discount_card':
      return discountExpiryRule({
        customExpiryDays: settings.discountCustomExpiryDays,
        specificExpiryDate: settings.discountSpecificExpiryDate,
      });
    default:
      return { mode: 'never' };
  }
}
