/**
 * registerService — register a pass holder against a template.
 *
 * @module modules/pass-templates/services/registerService
 * @description Three-step register flow:
 *   1. SELECT pass_holders WHERE (template_id, email) — short-circuit if exists.
 *   2. INSERT pass_holders — race-safe via re-fetch on 0-row RETURNING.
 *   3. (2026-10-19) Call Passcreator V3 `/api/v3/pass` to issue the
 *      holder's wallet pass. On success, persist the per-pass runtime
 *      fields. On failure, persist an `issuance_error` i18n key — the
 *      row is still considered registered (200 + retry banner).
 *
 * v2 (2026-09-29): NO status filter on the existence check. See Decision Log.
 *
 * Decision log:
 *   - runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *   - runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 *   - runs/decisions/2026-10-23-gift-card-paid-registration.md
 */

import type { Sql } from '@/shared/db/client';
import type { HonoEnv } from '@/shared/types/bindings';
import {
  NotFoundError,
  BadGatewayError,
  ValidationError,
} from '@/shared/lib/saomeError';
import type { PassHolderRegisterResponseDto, PassHolderIssuanceDto } from '@/shared/contracts/passTemplates';
import type { PassHolderRegisterPayload } from '../schemas/request';
import {
  findPublicTemplateById,
  normalizeGiftCardConfig,
} from '../db/templates';
import {
  upsertPassHolder,
  updatePassHolderIssuance,
  type PassHolderRow,
} from '../db/passHolders';
import { issuePass, getPassByIdentifier, listPasses } from '@/shared/lib/passcreator';
import {
  buildGiftCardSnapshot,
  validateGiftCardPurchase,
} from '@saome/shared/logic/giftCardPurchase';
import { giftCardSnapshotSchema } from '@saome/shared/schemas/passHolder';
import {
  membershipTierNameFromSnapshot,
  resolveMembershipTierSnapshot,
} from '@saome/shared/logic/membershipTier';
import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';
import type { Currency, TemplateSettings } from '@saome/shared/schemas/card';
import type { PasscreatorPassValues } from '@saome/shared/logic/passFieldFormatter';
import { membershipDurationTypeFromSnapshot } from '@saome/shared/logic/passExpiry';
import { ensureRegistrationRuntimeState } from './passRegistrationService';

/**
 * Gift-card purchase fields derived server-side from the template.
 *
 * `amount` is NEVER read from the request body — it is computed from the
 * template's own `giftCard*` settings by `buildGiftCardSnapshot`, so a
 * client cannot propose a price. The snapshot is additionally parsed
 * through `giftCardSnapshotSchema` before it reaches SQL (Rule 032 § 1:
 * validate jsonb in the application layer, never pass through).
 */
interface DerivedGiftCardPurchase {
  purchasedPoints: number;
  paidAmount: number;
  currency: 'TWD' | 'ZAR';
  giftCardSnapshot: unknown;
}

/**
 * Membership tier snapshot derived server-side from the TEMPLATE.
 *
 * `name` / `durationType` / `paidAmount` are NEVER read from the
 * request body — they are recomputed from the template's own
 * `settings.membershipTiers[]` by `resolveMembershipTierSnapshot`, so
 * a client cannot name a tier the tenant never offered nor quote a
 * price the tenant never set. The client only supplies the tier
 * INDEX it picked.
 *
 * 2026-10-27 — the FREE membership card case. A free card
 * (`isPaid === false`) still has exactly one tier WITH A NAME, so it
 * still gets a snapshot; the cycle and the price are null because a
 * free holder bought neither. Before this change the free path wrote
 * NO snapshot at all, so a free member's tier name was lost.
 */
interface DerivedMembershipTier {
  /** 0-based index of the tier the holder joined. */
  index: number;
  /**
   * The frozen snapshot, or `undefined` when the template has no
   * usable tier (a free card whose single tier was never named).
   */
  snapshot: unknown;
  /**
   * Forced payment status. Only set on the FREE path — a free card
   * has no payment concept, so 'not_required' is the only truthful
   * value regardless of what the client claimed.
   */
  paymentStatus?: 'not_required';
  /** Forced payment provider. Only set on the FREE path (always none). */
  paymentProvider?: undefined;
}

/**
 * Derive the membership tier snapshot + payment status from the
 * template's own state.
 *
 * @param template   - The template row (its `settings` carry the
 *                     authoritative tier list).
 * @param tierIndex  - The index the client picked, or `undefined`
 *                     for a non-membership card.
 * @throws `ValidationError` (400) when a PAID membership card is
 *         registered without a valid tier index.
 */
function deriveMembershipTierSnapshot(
  template: {
    card_type: string | null;
    is_paid?: boolean | null;
    settings: TemplateSettings | null | undefined;
    currency?: Currency | null;
  },
  tierIndex: number | undefined,
): DerivedMembershipTier | null {
  // Only membership cards have tiers. Every other card type (stamp /
  // reward / cashback / coupon / gift / multipass / discount) has no
  // tier list, so there is nothing to snapshot.
  if (template.card_type !== 'membership_card') return null;

  const tiers = template.settings?.membershipTiers;
  const isPaid = template.is_paid === true;

  // A PAID card: the client MUST have picked a tier, and that index
  // MUST resolve against the template's own tier list. Anything else
  // is a malformed request.
  if (isPaid) {
    if (tierIndex === undefined) {
      throw new ValidationError('passHolder.errors.membershipTierRequired', {
        reason: 'Paid membership registration requires selectedTierIndex',
      });
    }
    const snapshot = resolveMembershipTierSnapshot({
      tiers,
      index: tierIndex,
      currency: template.currency ?? 'TWD',
      mode: 'paid',
    });
    if (!snapshot) {
      throw new ValidationError('passHolder.errors.membershipTierInvalid', {
        reason: 'selectedTierIndex does not resolve to a usable template tier',
        tierIndex,
      });
    }
    return { index: tierIndex, snapshot };
  }

  // A FREE membership card: exactly one tier, index 0. The template
  // may have no tier at all (a draft that was never filled in) — in
  // that case there is simply no snapshot to write, and the
  // registration still succeeds.
  //
  // The payment status is FORCED to 'not_required' (migration 024
  // widened the DB CHECK to allow it). A free card has no payment
  // concept, so a client claiming 'completed' on it is server-side
  // corrected rather than persisted — the same "server decides"
  // posture the tier snapshot takes.
  const snapshot = resolveMembershipTierSnapshot({
    tiers,
    index: 0,
    currency: template.currency ?? 'TWD',
    mode: 'free',
  });
  return {
    index: 0,
    // `undefined` (not `null`) so the DB layer writes SQL NULL rather
    // than a JSONB `null` — the two are not the same to `IS NULL`
    // checks, and an absent tier is genuinely absent.
    snapshot: snapshot ?? undefined,
    paymentStatus: 'not_required',
    paymentProvider: undefined,
  };
}

/**
 * Re-derive (and validate) a gift-card purchase from the TEMPLATE's own
 * settings. Called only when `template.card_type === 'gift_card'`.
 *
 * Throws `ValidationError` with the stable i18n key produced by the
 * shared validator, so the frontend banner renders the same copy the
 * purchase form showed inline.
 *
 * @see runs/decisions/2026-10-23-gift-card-paid-registration.md
 */
function deriveGiftCardPurchase(
  payload: PassHolderRegisterPayload,
  giftConfig: PublicGiftCardConfig | null,
  currency: 'TWD' | 'ZAR',
): DerivedGiftCardPurchase {
  if (!giftConfig) {
    throw new ValidationError('passHolder.errors.giftCardNotConfigured', {
      reason: 'Gift card template has no usable purchase configuration',
    });
  }
  const points = payload.purchasedPoints;
  if (points === undefined) {
    // A gift card is always paid. Registering without points would
    // persist a "free gift card" row — exactly the semantic garbage
    // migration 024's cross-field rules exist to prevent.
    throw new ValidationError('passHolder.errors.giftCardPointsRequired', {
      reason: 'Gift card registration requires purchasedPoints',
    });
  }
  const validation = validateGiftCardPurchase(points, giftConfig);
  if (!validation.ok) {
    throw new ValidationError(validation.message, {
      reason: `Gift card purchase rejected: ${validation.code}`,
      code: validation.code,
      points,
    });
  }
  const snapshot = buildGiftCardSnapshot(points, giftConfig, currency);
  // Defence-in-depth: parse the snapshot before it reaches SQL so a
  // future refactor of the builder can't persist a self-inconsistent
  // JSONB blob (Rule 032 § 1).
  return {
    purchasedPoints: points,
    paidAmount: snapshot.amount,
    currency,
    giftCardSnapshot: giftCardSnapshotSchema.parse(snapshot),
  };
}

/**
 * Register a pass holder against a template.
 *
 * Behavior:
 *   - 404 when the template does not exist (no public template).
 *   - 200 + { ok, passHolderId, created: true, issuance? } on first
 *     register; `issuance` is populated when the V3 call succeeds
 *     OR fails (with `issuanceError` i18n key) — never throws on V3
 *     failure (q8-a confirmed — preserve 200 so the frontend can
 *     render a retry banner).
 *   - 200 + { ok, passHolderId, created: false, issuance? } on
 *     idempotent re-register (same email against same template). The
 *     `issuance` is taken from the EXISTING row (we don't re-issue
 *     — would create a duplicate pass for the same holder).
 *
 * The route layer (`routes/register.ts`) is responsible for zod parsing
 * (`passHolderRegisterPayloadSchema`) before this service is invoked.
 *
 * 2026-10-16 — paid-membership extension. The 4 pass-delivery fields
 * stay the source of truth and remain required. The 5 paid-membership
 * fields (`selectedTierIndex`, `membershipTierSnapshot`,
 * `paymentProvider`, `paymentStatus`) are optional and only present
 * when the template is a paid membership card. The DB layer
 * (`upsertPassHolder`) handles the optionality and applies migration
 * 023 defaults when the fields are missing.
 *
 * 2026-10-19 — V3 issuance wired in. `issuePass` is invoked immediately
 * after `upsertPassHolder` returns successfully for a NEW row (existing
 * rows skip re-issuance — see Decision Log § "Issue pass relation").
 * On V3 failure, `BadGatewayError.details.kind` discriminates the
 * underlying cause; the row is updated with `issuance_error =
 * 'passHolder.errors.upstreamFailed'` (the stable i18n key the
 * frontend banner surfaces) — `pass_identifier` / `download_url` /
 * `barcode_value` stay NULL so a retry can re-populate them.
 *
 * @param sql        - postgres.js instance
 * @param env        - Hono env bindings (for Passcreator V3 call)
 * @param templateId - template UUID from URL path
 * @param payload    - validated PassHolderRegisterPayload
 * @returns          - PassHolderRegisterResponseDto
 * @throws           - `NotFoundError` when the template does not exist
 *   - `ValidationError` (400) when a gift-card purchase is missing its
 *     points, out of range, not priceable by the tenant's rate, or the
 *     template has no usable rate configured
 *
 * 2026-10-23 — gift-card registration. A gift card is ALWAYS paid, so
 * the service derives the amount from the template's own `giftCard*`
 * settings rather than trusting anything in the payload. See
 * `runs/decisions/2026-10-23-gift-card-paid-registration.md`.
 */
export async function registerService(
  sql: Sql,
  env: HonoEnv['Bindings'],
  templateId: string,
  payload: PassHolderRegisterPayload,
): Promise<PassHolderRegisterResponseDto> {
  // 1. Verify the template exists (v2: any status — see Decision Log).
  // We don't read its full body; just need existence for FK integrity
  // AND for the `passcreator_template_id` we need for V3 issuance.
  const template = await findPublicTemplateById(sql, templateId);
  if (!template) {
    throw new NotFoundError('passHolder.errors.templateNotFound', 'Template not found');
  }

  // 2. Idempotent INSERT (UNIQUE constraint on (template_id, email)).
  // Pass through the paid-membership fields when present. The DB layer
  // normalizes missing values via migration 023 defaults (NULL for
  // most, 'pending' for `payment_status`, TWD for `currency` via the
  // backfill).
  //
  // 2026-10-23 — gift-card branch. When the template is a gift card we
  // RE-DERIVE the amount from the template's own settings before the
  // write; the client's `purchasedPoints` is the only purchase input we
  // trust. `paidAmount` + `currency` had never been written by any code
  // path (both columns exist since migration 023) — this is where they
  // finally become reachable.
  const isGiftCard = template.card_type === 'gift_card';
  const giftPurchase: DerivedGiftCardPurchase | null = isGiftCard
    ? deriveGiftCardPurchase(
        payload,
        normalizeGiftCardConfig(template.gift_card_config),
        template.currency ?? 'TWD',
      )
    : null;

  // 2026-10-27 — membership tier snapshot. The snapshot is derived
  // SERVER-SIDE from the template's own tier list; the client's
  // `membershipTierSnapshot` is not trusted (it is ignored). The
  // client only supplies the tier INDEX it picked.
  //
  // A FREE membership card gets a snapshot too — it has one tier with
  // a NAME, so the tier name must not be lost. Its cycle and price
  // are null (a free holder bought neither).
  const tierPurchase = deriveMembershipTierSnapshot(
    template,
    payload.selectedTierIndex,
  );

  const { row, created } = await upsertPassHolder(sql, {
    templateId,
    name: payload.name,
    phoneCountryCode: payload.phoneCountryCode,
    phoneNumber: payload.phoneNumber,
    birthday: payload.birthday,
    email: payload.email,
    // Paid-membership extension — undefined flows through to the DB as
    // NULL or the migration 023 default. See `upsertPassHolder`.
    //
    // 2026-10-27 — `selectedTierIndex` and `membershipTierSnapshot`
    // now come from the server-derived tier purchase, NOT from the
    // payload. A free membership card writes index 0.
    selectedTierIndex: tierPurchase?.index,
    membershipTierSnapshot: tierPurchase?.snapshot,
    // 2026-10-27 — a free membership card's payment status is forced
    // to 'not_required' server-side (it has no payment concept). A
    // paid card keeps whatever the client simulated.
    //
    // The check is on `paymentStatus` (not on the provider's
    // `undefined`) — a `??` against the provider would fall through
    // to the client's value exactly when we want to clear it.
    paymentProvider:
      tierPurchase?.paymentStatus === 'not_required'
        ? undefined
        : payload.paymentProvider,
    paymentStatus:
      tierPurchase?.paymentStatus === 'not_required'
        ? 'not_required'
        : payload.paymentStatus,
    // 2026-10-23 — gift-card purchase fields. Only populated on the
    // gift branch, so every other card type writes NULL exactly as
    // before (regression guard in `register.test.ts`).
    purchasedPoints: giftPurchase?.purchasedPoints,
    paidAmount: giftPurchase?.paidAmount,
    currency: giftPurchase?.currency,
    giftCardSnapshot: giftPurchase?.giftCardSnapshot,
  });

  // 3. (2026-10-24) Runtime values — the holder's `registered` event
  //    + the derived snapshot.
  //
  //    This runs BEFORE the Passcreator call so the FIRST issuance can
  //    carry the opening values (a gift card's purchased points, the
  //    card's expiry). The Wallet therefore never shows an empty
  //    balance on first install, and we never have to create an empty
  //    pass and PATCH it afterwards.
  //
  //    The step is idempotent: the event carries the key
  //    `registered:{holderId}`, so a re-registration (or a retry after
  //    a failed issuance) does NOT create a second opening event.
  //
  //    It is also durable: if the Passcreator call then fails, the
  //    ledger + snapshot stay committed and a later retry re-pushes
  //    the SAME values — it never adds them twice.
  const runtime = await ensureRegistrationRuntimeState(sql, {
    passHolderId: row.id,
    cardType: template.card_type,
    settings: template.settings,
    // Gift card only — the prepaid points ARE the opening balance.
    // `buildInitialMetrics` ignores this for every other card type.
    purchasedPoints: row.purchased_points ?? null,
    // Paid membership only — the tier duration the holder bought,
    // read from their PERSISTED frozen tier snapshot (never from the
    // request payload, and never recomputed from the template — a
    // template can offer monthly AND yearly tiers at once).
    membershipDurationType: membershipDurationTypeFromSnapshot(
      row.membership_tier_snapshot,
    ),
    // The event's timestamp AND its expiry anchor both come from the
    // holder row's `created_at`, not from "now" — so a holder who
    // registers again after this feature shipped keeps the expiry they
    // would have received originally.
    registeredAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  });

  // 2026-10-27 — the holder's membership tier NAME, for the
  // `data.memberLevel` field on the Passcreator V3 create body.
  //
  // It is read from the holder's PERSISTED frozen tier snapshot
  // (never recomputed from the template at issuance time — the
  // snapshot is what froze at registration). Only membership cards
  // have a tier, so every other card type omits the field entirely
  // and produces exactly the pre-2026-10-27 body.
  const memberLevel =
    template.card_type === 'membership_card'
      ? (membershipTierNameFromSnapshot(row.membership_tier_snapshot) ?? undefined)
      : undefined;

  // 4. (2026-10-19) V3 issuance — only attempt for NEW rows OR for
  // existing rows whose `pass_identifier` was never populated (e.g.
  // the row was created during a Passcreator outage and we left it
  // un-issued). Already-issued rows short-circuit and return the
  // existing issuance data verbatim — Decision Log § "Issue pass
  // relation" prevents duplicate passes for the same (template, email).
  //
  // `runtime.values` is the SAME formatter output the later PATCH
  // consumes (Decision Log § 決定三) — the value written at creation
  // and the value written at update time are formatted identically.
  const issuance = await attemptIssuance(
    sql,
    env,
    row,
    template.passcreator_template_id,
    runtime.values,
    memberLevel,
  );

  return {
    ok: true,
    passHolderId: row.id,
    created,
    issuance,
  };
}

/**
 * Attempt Passcreator V3 issuance for a fresh / un-issued holder row.
 *
 * Decision log: runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 * § "V3 呼叫時機：B — 註冊成功立即發行".
 *
 * Behavior:
 *   - Row already has `pass_identifier` populated → return the
 *     existing issuance data verbatim (idempotent re-register path).
 *   - Template has no `passcreator_template_id` (never pushed to
 *     Passcreator) → return undefined; the frontend surfaces "Pass
 *     not yet ready, please retry later". We DON'T write an error
 *     key because this is a known-pre-launch state, not a failure.
 *   - V3 call succeeds → write the runtime fields to DB; return
 *     the persisted artifact.
 *   - V3 call throws `BadGatewayError` → write the i18n key to DB
 *     (issuance_error) and return the failure DTO so the frontend
 *     banner can render "重試簽發". We do NOT re-throw — the holder
 *     row is in a valid state, the user just hasn't received the
 *     .pkpass yet.
 *   - V3 call throws any other Error → unexpected. We log via
 *     `console.warn` and treat it as upstream_failed (defensive —
 *     `passcreatorFetch` should always wrap into `BadGatewayError`,
 *     but a future refactor could regress this contract).
 */
async function attemptIssuance(
  sql: Sql,
  env: HonoEnv['Bindings'],
  row: PassHolderRow,
  passcreatorTemplateId: string | null | undefined,
  values?: PasscreatorPassValues,
  memberLevel?: string,
): Promise<PassHolderIssuanceDto | undefined> {
  // Short-circuit: already issued. Return whatever runtime fields
  // are present on the row (idempotent re-register path).
  if (row.pass_identifier) {
    return {
      passIdentifier: row.pass_identifier,
      downloadPage: row.download_url ?? undefined,
      barcodeValue: row.barcode_value ?? null,
      issuedAt:
        row.issued_at instanceof Date
          ? row.issued_at.toISOString()
          : typeof row.issued_at === 'string'
            ? row.issued_at
            : undefined,
    };
  }

  // No Passcreator template id → template never pushed upstream.
  // Per Decision § "V3 呼叫時機": we don't error here because this
  // is a known-pre-launch state for new templates. Frontend surfaces
  // "Pass not ready yet" via the absence of `downloadPage`.
  if (!passcreatorTemplateId) {
    return undefined;
  }

  // V3 call — wrapped in try/catch so BadGatewayError doesn't
  // propagate (we want to preserve 200 + `issuanceError`).
  try {
    const issued = await issuePass(
      env,
      passcreatorTemplateId,
      {
        name: row.name,
        phone: `${row.phone_country_code}${row.phone_number}`,
        birthday: row.birthday,
        email: row.email,
        // 2026-10-27 — the holder's membership tier name. The key is
        // OMITTED (not set to undefined) for every non-membership
        // card, so those produce exactly the pre-2026-10-27 body.
        ...(memberLevel !== undefined ? { memberLevel } : {}),
      },
      // The holder's OPENING runtime values (points / balance /
      // expiry). Same wire shape the later PATCH consumes — one
      // contract for create + update.
      values,
    );
    const issuedAt = new Date();
    // 2026-10-19 — Persist ALL 3 URIs that V3 returns. Migration 026
    // adds `iphone_uri` + `android_uri` columns; even Apple/Passwallet-
    // only templates get a real androidUri string from V3, so we
    // capture it for audit trail (frontend does user-agent detection
    // via `pickDownloadUri()` to surface the right one in the UI).
    await updatePassHolderIssuance(sql, {
      id: row.id,
      passIdentifier: issued.identifier,
      downloadUrl: issued.downloadPage,
      barcodeValue: issued.barcodeValue,
      issuedAt,
      iPhoneUri: issued.iPhoneUri,
      androidUri: issued.androidUri,
    });

    // 2026-10-18 — P0 #4 barcode backfill. For templates with
    // `useAutoIdForValue=true`, V3 CREATE returns a placeholder
    // `barcodeValue` ("no value specified") that the parser
    // normalizes to `null`. The real per-pass barcode rendered on
    // the wallet pass lives at `generatedId` (single-pass GET) or
    // `autoGeneratedId` (LIST). Production was persisting
    // `barcode_value = NULL` until this backfill wire-up — the
    // user saw a real barcode in Passcreator's dashboard but a
    // null value in our DB.
    //
    // Backfill strategy (best-effort, doesn't affect registration
    // status):
    //   1. PRIMARY: `getPassByIdentifier` (single-pass GET) — fast,
    //      single HTTP call, returns the matched identifier with
    //      `generatedId` exposed.
    //   2. FALLBACK: `listPasses` with identifier filter — used when
    //      single-pass GET is unavailable (network race, Passcreator
    //      contract drift). Returns the matched identifier with
    //      `autoGeneratedId` exposed.
    //   3. BOTH FAIL: `barcode_value` stays `null`; registration
    //      still returns 200 (barcode is best-effort).
    //
    // We ONLY backfill when `issued.barcodeValue === null` —
    // templates WITHOUT `useAutoIdForValue` (or with a real barcode
    // configured) already get a non-null value from V3 CREATE and
    // don't need the extra round-trip.
    if (issued.barcodeValue === null) {
      const backfilled = await backfillBarcodeValue(
        env,
        passcreatorTemplateId,
        issued.identifier,
      );
      if (backfilled !== null) {
        // Second UPDATE carries ONLY the backfilled barcode. We
        // don't overwrite the URIs (they were already persisted
        // correctly from the CREATE response) — just the barcode.
        await updatePassHolderIssuance(sql, {
          id: row.id,
          barcodeValue: backfilled,
        });
        // Reflect in the returned DTO so the frontend sees the
        // backfilled value (NOT null).
        issued.barcodeValue = backfilled;
      }
    }

    return {
      passIdentifier: issued.identifier,
      downloadPage: issued.downloadPage,
      iPhoneUri: issued.iPhoneUri,
      androidUri: issued.androidUri,
      barcodeValue: issued.barcodeValue,
      issuedAt: issuedAt.toISOString(),
    };
  } catch (err) {
    // Log for observability (the frontend banner is the real user-
    // facing surface; this log helps ops correlate the failure rate).
    // eslint-disable-next-line no-console
    console.warn(
      '[registerService] Passcreator V3 issuance failed for holder',
      row.id,
      ':',
      err instanceof Error ? err.message : String(err),
    );
    // Map upstream errors to a stable i18n key. The frontend has a
    // single banner copy ("重試簽發") for any failure; we don't
    // differentiate kinds in the response to keep the contract
    // small. Kind-aware copy is a future hardening.
    const i18nKey = 'passHolder.errors.upstreamFailed';
    try {
      await updatePassHolderIssuance(sql, {
        id: row.id,
        issuanceError: i18nKey,
      });
    } catch (updateErr) {
      // Even the error-write failed — surface as a 502 so the
      // frontend at least sees a different signal than "register
      // succeeded". This is the only path where `registerService`
      // lets a `BadGatewayError` escape.
      if (err instanceof BadGatewayError) throw err;
      throw new BadGatewayError({
        upstream: 'passcreator',
        upstreamStatus: 502,
        upstreamBody: `issuance + update both failed: ${String(updateErr)}`,
      });
    }
    return { issuanceError: i18nKey };
  }
}

/**
 * Fetch the real auto-generated barcode value for a per-pass wallet
 * pass. Used by `attemptIssuance` immediately after a successful V3
 * CREATE when the create response's `barcodeValue` is `null` (which
 * is the post-normalize form of the `"no value specified"`
 * placeholder Passcreator returns for `useAutoIdForValue=true`
 * templates).
 *
 * Strategy (best-effort, see `attemptIssuance` for full rationale):
 *   1. PRIMARY: `getPassByIdentifier` — single-pass GET, returns
 *      `data.generatedId` as the auto-gen barcode.
 *   2. FALLBACK: `listPasses` with `identifier` filter — returns
 *      `data[].autoGeneratedId` for the matched item.
 *   3. BOTH FAIL: returns `null` (the holder row keeps
 *      `barcode_value = NULL`; registration still succeeds because
 *      barcode persistence is best-effort).
 *
 * Why best-effort and NOT surfaced as an `issuanceError`:
 * - The holder row's registration is the primary success signal;
 *   the user has already received their pass identifier + URIs.
 * - A barcode backfill failure (network race, transient Passcreator
 *   hiccup) shouldn't prompt the frontend to render a retry banner
 *   for the entire registration — that would be misleading.
 * - The barcode can be re-populated via a follow-up admin tool or
 *   a future cron job; it's not a critical-path data point.
 *
 * @returns The real barcode string OR `null` if both backfill paths
 *          failed / returned a placeholder.
 *
 * @see runs/improvements/feedback/20261018-passcreator-v3-barcode-backfill.md
 * @see apps/backend/src/shared/lib/passcreator.ts (`getPassByIdentifier`,
 *      `listPasses`, `extractBackfillBarcodeValue`)
 */
async function backfillBarcodeValue(
  env: HonoEnv['Bindings'],
  passcreatorTemplateId: string,
  identifier: string,
): Promise<string | null> {
  // PRIMARY: single-pass GET.
  try {
    const fetched = await getPassByIdentifier(env, identifier);
    if (fetched.barcodeValue !== null) {
      return fetched.barcodeValue;
    }
    // Primary succeeded but barcode is still null — template has
    // no barcode configured (neither `generatedId` nor
    // `barcodeValue` is populated). No need to try the fallback.
    return null;
  } catch (primaryErr) {
    // Primary failed (network / upstream_rejected / invalid_response).
    // Log at warn level (not error — backfill is best-effort) and
    // fall through to LIST fallback.
    // eslint-disable-next-line no-console
    console.warn(
      '[registerService] barcode backfill PRIMARY (getPassByIdentifier) failed:',
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    );
  }

  // FALLBACK: LIST with identifier filter. May paginate past the
  // target identifier (Passcreator accounts with >100 passes), in
  // which case the matched list is empty → barcode stays null.
  try {
    const listed = await listPasses(env, {
      templateId: passcreatorTemplateId,
      identifier,
    });
    const matched = listed.find((p) => p.identifier === identifier);
    return matched?.barcodeValue ?? null;
  } catch (fallbackErr) {
    // eslint-disable-next-line no-console
    console.warn(
      '[registerService] barcode backfill FALLBACK (listPasses) also failed:',
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
    );
    return null;
  }
}