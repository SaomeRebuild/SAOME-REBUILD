/**
 * Templates table queries.
 *
 * @module modules/cards/db/templates
 * @description Pure SQL functions for the `templates` table.
 */

import type { Sql } from '@/shared/db/client';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';

// Re-export so existing callers (e.g. services/cardService.ts) that import
// `CardFieldKey` from this module keep working. The local definition is
// sourced from the shared constant so it auto-conforms when
// `CARD_FIELD_KEYS` is extended (Rule 019 § 4.1 layer 3 of 4 — Layer 1
// is `CARD_FIELD_KEYS`, Layer 2 is `cardFieldKeySchema` derived via
// `z.enum([...CARD_FIELD_KEYS])`, Layer 3 is this re-exported type, Layer
// 4 is the service signature which uses `TemplateSettings.leftField`).
export type { CardFieldKey };

export interface TemplatesRow {
  id: string;
  tenant_id: string;
  status: 'draft' | 'published' | 'abandoned';
  name: string;
  /** Card type. NULL = user has not selected a type yet (orphan draft). */
  card_type?: CardType;
  settings: TemplateSettings;
  created_at: Date;
  updated_at: Date;
  /** Draft TTL: now() + 24h. NULL = published/never-expires. */
  expires_at?: Date;
}

/** Card types supported by the card builder */
export type CardType =
  | 'stamp_card'
  | 'cashback_card'
  | 'reward_card'
  | 'membership_card'
  | 'discount_card'
  | 'coupon_card'
  | 'multipass'
  | 'gift_card';

/**
 * Card face field keys (Step 3 — 顯示欄位).
 *
 * Mirrors `cardFieldKeySchema` in packages/shared/schemas/card.ts and
 * `CARD_FIELD_KEYS` in packages/shared/constants/card-fields.ts. This is
 * the DB-layer interface (Rule 019 § 4.1, layer 3 of 4) so service param
 * types and JSONB column contracts pick up the same value set.
 *
 * 2026-09-10: this used to be a hand-maintained union literal (only the
 * 6 common keys were listed). That was a drift risk — every time
 * `CARD_FIELD_KEYS` was extended (stamp 3 keys, reward 2 keys), the
 * hand-maintained union silently diverged. Now sourced from
 * `@saome/shared/constants/card-fields::CardFieldKey` so the type
 * auto-conforms. Re-exported via `export type { CardFieldKey }` near the
 * top of this file to keep the public surface unchanged.
 */

/**
 * Template settings — flat JSONB structure.
 *
 * Step 1: cardType (also held in SQL column `templates.card_type`).
 *         Card Name lives in the SQL column `templates.name` — NOT here.
 * Step 2: barcodeType, logoText (JSONB), issuerName, passValidDays, expiryDate, currency
 * Membership extension: isPaid
 * Step 3-4: TBD (backgroundColor, textColor, etc.)
 *
 * 2026-09-13 semantic swap: `storeName` (the Card Name, conceptually) was
 * misleadingly stored in JSONB; the value actually rendered in the pass
 * header (Logo Text) was held in the SQL column `templates.name`. After
 * the swap: `templates.name` = Card Name (pass record name), and
 * `settings.logoText` = Logo Text (pass header text). See migration 018.
 */
export interface TemplateSettings {
  cardType?: CardType;
  barcodeType?: 'qr_code' | 'pdf_417';
  /** Logo Text — shown on the pass header (next to issuer logo). */
  logoText?: string;
  issuerName?: string;
  passValidDays?: number | null;
  expiryDate?: string;
  currency?: 'TWD' | 'ZAR';
  /**
   * Card display language (zh-TW | en). Controls which language the card
   * fields are translated into when sent to Passcreator (deferred).
   * 2026-09-18 Step 2: added for Passcreator future integration.
   */
  language?: 'zh-TW' | 'en';
  // Step 3-4 fields (TBD)
  issuerLogo?: string;
  /**
   * Push-notification icon (R2 key) — mirrors shared templateSettingsSchema.iconImage.
   * Phase 5 of IconUploader plan (2026-08-31).
   */
  iconImage?: string;
  /**
   * Background image (R2 key) — reserved for next BackgroundUploader plan.
   * Mirrors shared templateSettingsSchema.backgroundImage.
   */
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  holderName?: string;
  cardSide?: 'front' | 'back';
  /**
   * Step 3 — 顯示欄位: left-slot display field key.
   * Rule 019 § 4.1 layer 3 of 4 — keep in sync with shared `templateSettingsSchema.leftField`.
   */
  leftField?: CardFieldKey;
  /**
   * Step 3 — 顯示欄位: right-slot display field key.
   * Rule 019 § 4.1 layer 3 of 4 — keep in sync with shared `templateSettingsSchema.rightField`.
   */
  rightField?: CardFieldKey;
  // Membership card extension
  isPaid?: boolean;
  /**
   * Step 3 — Stamp grid: number of rows in the stamp grid (1..4).
   * Mirrors `shared/templateSettingsSchema.stampGridRows` (Rule 019 § 4.1 layer 3 of 4).
   * Used on stamp_card and multipass card types.
   */
  stampGridRows?: 1 | 2 | 3 | 4;
  /**
   * Step 3 — Stamp grid: icon manifest id (e.g. 'bell', 'fire').
   * Mirrors `shared/templateSettingsSchema.stampIconId` (Rule 019 § 4.1 layer 3 of 4).
   */
  stampIconId?: string;
  // ===== Step 4 — 卡片資訊 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.description / backFields / links`.
  // Step 4 plan 2026-09-04: see packages/shared/schemas/card.ts for source.
  /**
   * Card description (PassCardPreviewBack Section 1). Max 200 chars per
   * shared schema.
   */
  description?: string;
  /**
   * Back fields shown as label/value rows (PassCardPreviewBack Section 4).
   * PassKit convention is one Label + Value per row.
   */
  backFields?: Array<{ label: string; value: string }>;
  /**
   * Dedicated link fields (PassCardPreviewBack Section 5). PassKit separates
   * `links` from `backFields` — they render in distinct UI areas. URL
   * validation lives in shared/logic/links.ts (UI-layer).
   */
  links?: Array<{ label: string; value: string }>;
  // ===== Step 5 — 地理位置 + 推播訊息 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.initialMessage / locations`.
  // Step 5 plan 2026-09-05: see packages/shared/schemas/card.ts for source.
  /**
   * Push-notification body shown after the user downloads the pass
   * (Passcreator "Initial message"). Max 50 chars per INITIAL_MESSAGE_MAX_LENGTH.
   */
  initialMessage?: string;
  /**
   * Geolocation toggle (Passcreator API field). When `true` the pass
   * does NOT trigger geolocation-based notifications; Step 5 in the
   * CardBuilder editor can be skipped. Default `false` (geolocation
   * enabled). Added 2026-09-06.
   */
  locationsDisabled?: boolean;
  /**
   * Geolocation triggers for the pass. Each entry maps to one Apple Wallet
   * pkpass `relevantLocations` row (Passcreator API-aligned). Capped at 10
   * (LOCATIONS_MAX). Per-row shape (2026-09-06 refactor):
   *   - `name` (user-facing label)
   *   - `latitude` / `longitude` (REQUIRED — previously optional)
   *   - `relevantText` (optional lock-screen message; ≤ 100 chars)
   */
  locations?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    relevantText?: string | null;
  }>;
  // ===== Step 5 — Locations max distance (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.locationsMaxDistance`.
  // Step 5 plan 2026-09-06 rename: was `notificationRadius`; renamed to
  // align with the Passcreator API field name.
  /**
   * Locations max distance in meters — pass-level setting (Passcreator
   * `locationsMaxDistance`). Bounded to [100, 1000] per Apple Wallet /
   * PassKit spec. `null` (= field absent) signals PassKit to use the
   * pass-type default (event/boarding → up to 1000 m; coupon/store/
   * membership → up to 100 m). User-explicit values are stored as
   * integers.
   */
  locationsMaxDistance?: number | null;
  // DEPRECATED 2026-09-06: kept for backward-compat reads from DB rows
  // that pre-date Migration 017 (rename notificationRadius → locationsMaxDistance).
  // Frontend no longer writes this key. New writes use `locationsMaxDistance`.
  notificationRadius?: number | null;
  // ===== Step 6 — 集點卡邏輯 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.stampAccrualMode / rewardName /
  // rewardType / rewardValue / maxDiscountAmount`. Step 6 plan 2026-09-07 —
  // first card-type-specific logic editor; the dispatcher lives at
  // `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/`.
  /**
   * 蓋章模式: per_stamp (手動蓋章) / per_visit (來訪蓋章) / per_spend (消費蓋章).
   * Mirrors mu-plugins `_stamp_accrual_type` (camelCased).
   * Only used when cardType === 'stamp_card' | 'multipass'.
   * Type includes `| null` because zod schema uses `.nullable().optional()`
   * (frontend store uses null for "unselected").
   */
  stampAccrualMode?: 'per_stamp' | 'per_visit' | 'per_spend' | null;
  /**
   * 獎勵名稱 (例: "10元折價活動"). Max 40 chars per REWARD_NAME_MAX_LENGTH.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].name`.
   */
  rewardName?: string;
  /**
   * 獎勵類型: amount_off (訂單折抵現金) / percent_off (訂單折抵百分比).
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_type`.
   * Type includes `| null` because zod schema uses `.nullable().optional()`.
   */
  rewardType?: 'amount_off' | 'percent_off' | null;
  /**
   * 折抵金額 (amount_off) 或百分比整數 (percent_off).
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_value`.
   * `.positive()` is the contract — UI `setRewardValue` rejects ≤ 0.
   * Type includes `| null` because zod schema uses `.nullable().optional()`.
   */
  rewardValue?: number | null;
  /**
   * 最高折抵金額 (僅 percent_off 模式有意義). `null` = 無上限.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].max_discount_amount`.
   */
  maxDiscountAmount?: number | null;
  // ===== Step 6 — Accrual thresholds (2026-09-07) =====
  /**
   * 來訪門檻：每 stampsPerVisitCount 次拜訪可獲得 stampsPerVisitStamps 個蓋章。
   * stampsPerVisitCount ∈ [1, ∞); stampsPerVisitStamps ∈ [1, ∞)。
   * 2026-09-07 新增。
   */
  stampsPerVisitCount?: number | null;
  stampsPerVisitStamps?: number | null;
  /**
   * 消費門檻：每消費 stampsPerSpendAmount 元可獲得 stampsPerSpendStamps 個蓋章。
   * stampsPerSpendAmount > 0; stampsPerSpendStamps ∈ [1, ∞)。
   * 2026-09-07 新增。
   */
  stampsPerSpendAmount?: number | null;
  stampsPerSpendStamps?: number | null;
  // ===== Step 6 — Gift Card 卡 (Rule 019 § 4.1, layer 3 of 4, 2026-09-27) =====
  // Mirrors `shared/templateSettingsSchema.giftCardAmount / giftCardPoints`.
  // Prepaid model — single flat exchange rate (X 元 = Y 點). Step 6 plan
  // 2026-09-27: eighth card-type-specific logic editor (after stamp_card /
  // multipass / reward_card / cashback_card / membership_card /
  // discount_card / coupon_card).
  //
  //   - giftCardAmount: 消費金額（顧客付多少元）. 整數 ≥ 1. 預設 1.
  //   - giftCardPoints: 獲得點數（顧客獲得多少點）. 整數 ≥ 1. 預設 1.
  //
  // The dispatcher lives at
  // `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/GiftCardLogic/`.
  // Step 2 hides PassValidDaysField + ExpiryDateField for gift_card (matching
  // membership_card / discount_card / multipass behavior — gift cards have no
  // time concept). Step 3 hides `memberLevel` for gift_card via
  // `hideOnCardTypes: ['coupon_card', 'gift_card']` in card-fields.ts.
  /**
   * 禮品卡兌換比率：消費金額（顧客付多少元）. 整數 ≥ 1. 預設 1.
   * Mirrors `shared/templateSettingsSchema.giftCardAmount`.
   */
  giftCardAmount?: number | null;
  /**
   * 禮品卡兌換比率：獲得點數（顧客獲得多少點）. 整數 ≥ 1. 預設 1.
   * Mirrors `shared/templateSettingsSchema.giftCardPoints`.
   */
  giftCardPoints?: number | null;
  // ===== Step 6 — REWARD 卡 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.rewardTiers`.
  // Step 6 plan 2026-09-09: second card-type-specific logic editor (after
  // stamp_card / multipass). Differs from stamp logic in two key ways:
  //   - Reward card is **points-driven** (vs stamp's stamp-driven).
  //   - Reward card supports **up to 5 reward tiers** (vs stamp's single reward).
  // The dispatcher lives at
  // `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/`.
  //
  // 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (top-level);
  // `pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints`
  // are PER-TIER (inside each `rewardTiers[*]` entry). Switching the
  // card-wide earningMode via `setEarningMode` clears all per-tier earn
  // fields so no stale data leaks across modes.
  /**
   * 整張卡片的點數累積方式 (2026-09-09, top-level — moved back from per-tier).
   * Mirrors `shared/templateSettingsSchema.earningMode`.
   * One mode per card. null = 未選.
   */
  earningMode?: 'based_on_points' | 'based_on_visits' | 'based_on_spending' | null;
  /**
   * 獎勵級距陣列（最多 5 組）.
   * Mirrors mu-plugins `_reward_program_tiers_json` (which uses an array; SAOME-REBUILD
   * also uses an array but capped at 5 tiers per user spec 2026-09-09).
   *
   * Each tier shape:
   *   - `name` (1..40 chars): tier name shown on the pass.
   *   - `threshold` (≥ 1): points required to unlock the tier.
   *   - `rewardType` ('amount_off' | 'percent_off'): cash discount or percentage.
   *   - `rewardValue` (> 0): cash amount or percentage integer.
   *   - `maxDiscountAmount` (≥ 0 or null): cap for percent_off mode; null = no cap.
   *   - `pointsPerVisit` (≥ 1 or null): only meaningful when card-wide
   *       earningMode is 'based_on_visits'. Points awarded per visit (this tier).
   *   - `pointsPerSpendAmount` (> 0 or null): only meaningful when card-wide
   *       earningMode is 'based_on_spending'. Trigger spend threshold (this tier).
   *   - `pointsPerSpendPoints` (≥ 1 or null): only meaningful when card-wide
   *       earningMode is 'based_on_spending'. Points awarded when spend
   *       threshold is hit (this tier).
   */
  rewardTiers?: Array<{
    name: string;
    threshold: number;
    rewardType: 'amount_off' | 'percent_off';
    rewardValue: number;
    maxDiscountAmount?: number | null;
    pointsPerVisit?: number | null;
    pointsPerSpendAmount?: number | null;
    pointsPerSpendPoints?: number | null;
  }>;
  // ===== Step 6 — Membership 卡 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.membershipTiers`.
  // Step 6 plan 2026-09-13: fourth card-type-specific logic editor. Simplest
  // tier structure: each tier is independent (no threshold / no earning mode).
  // Up to MAX_MEMBERSHIP_TIERS=5 tiers, each with optional durationType +
  // monthlyCost + yearlyCost + per-tier 會員獎勵 sub-rows (up to 5 each).
  /**
   * Card-wide expiry toggle (2026-09-13). When `false` (default), the
   * membership tier has no expiry (lifetime membership). When `true`,
   * each tier must specify `durationType` (monthly / yearly) + the
   * corresponding cost. Frontend store: `setHasExpiry(false)` ALSO clears
   * all per-tier `durationType` / `monthlyCost` / `yearlyCost` so no
   * stale data leaks.
   */
  hasExpiry?: boolean;
  /**
   * Membership tier array (最多 5 組). Each tier carries:
   *   - `name` (1..40 chars): tier name shown on the pass.
   *   - `durationType` ('monthly' | 'yearly' | null): per-tier duration.
   *       null is legitimate when card-wide `hasExpiry` is false (lifetime).
   *   - `monthlyCost` (≥ 0 or null): cost when durationType === 'monthly'.
   *       0 = free member tier. Ignored when hasExpiry === false.
   *   - `yearlyCost` (≥ 0 or null): cost when durationType === 'yearly'.
   *       0 = free member tier. Ignored when hasExpiry === false.
   *   - `lifetimeCost` (≥ 0 or null): cost when card-wide hasExpiry === false.
   *       0 = free lifetime member. Ignored when hasExpiry === true.
   *       2026-09-13 新增: 終身會員也需要費用欄位(租戶可一次性收費,
   *       消費者直接購買終身會員等級的權利). 與 monthly/yearly 互斥.
   *   - `rewards` (≤ 5 rows): per-tier 會員獎勵 sub-rows. Each row is a
   *       {label (1..20), value (1..80)} pair.
   */
  membershipTiers?: Array<{
    name: string;
    durationType?: 'monthly' | 'yearly' | null;
    monthlyCost?: number | null;
    yearlyCost?: number | null;
    lifetimeCost?: number | null;
    rewards?: Array<{ label: string; value: string }>;
  }>;
  // ===== Step 6 — Free Membership Card expiry (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.membershipExpiryMode` /
  // `membershipCustomExpiryDays` / `membershipSpecificExpiryDate`.
  // Step 6 plan 2026-09-14: extends membership_card editor with free-card
  // (isPaid=false) card-level expiry. Differs from paid-card expiry
  // (durationType + monthlyCost/yearlyCost):
  //   - Paid card: per-tier durationType (monthly/yearly) + per-tier cost
  //     tied to the purchase cycle.
  //   - Free card: card-level expiry mode (custom_days | specific_date)
  //     + corresponding value, independent of any purchase cycle.
  //
  // Frontend store: `setIsPaid(true)` clears these three fields. `setIsPaid(false)`
  // does NOT auto-populate them — the user picks via the editor.
  /**
   * 免費會員卡專用期限模式 (2026-09-14, 僅免費卡 isPaid=false 時生效).
   * - 'custom_days': 自訂 N 天後到期 (見 membershipCustomExpiryDays)
   * - 'specific_date': 指定到期日 (見 membershipSpecificExpiryDate, ISO YYYY-MM-DD)
   * null = 未設定.
   */
  membershipExpiryMode?: 'custom_days' | 'specific_date' | null;
  /**
   * 免費會員卡自訂天數 (membershipExpiryMode === 'custom_days' 時使用).
   * 整數 [CUSTOM_EXPIRY_DAYS_MIN=1, CUSTOM_EXPIRY_DAYS_MAX=3650 (10 年)].
   * null = 未填.
   */
  membershipCustomExpiryDays?: number | null;
  /**
   * 免費會員卡指定到期日 (membershipExpiryMode === 'specific_date' 時使用).
   * ISO YYYY-MM-DD 字串. null = 未填.
   */
  membershipSpecificExpiryDate?: string | null;
  // ===== Step 6 — Cashback 卡 (Rule 019 § 4.1, layer 3 of 4) =====
  // Mirrors `shared/templateSettingsSchema.cashbackTiers`.
  // Step 6 plan 2026-09-11: third card-type-specific logic editor (after
  // stamp_card and reward_card). Simplest of the three: each tier is a
  // flat rule of "cumulative spend → cashback %". No earning-mode switch
  // and no point accrual (the result IS a percentage discount).
  //
  // Differs from reward_card structurally:
  //   - No `earningMode` (cashback is always spend-driven).
  //   - No `rewardType / rewardValue / maxDiscountAmount` — cashback is a
  //     direct % rebate.
  //   - `thresholdSpend` = 0 IS a legitimate "default tier" (everyone
  //     qualifies without needing to accumulate spending). This is the key
  //     semantic distinction from reward_card.
  //
  // Frontend store enforces sort order (thresholdSpend ASC, 0 first);
  // backend only validates structure and bounds. Capped at 5 tiers per
  // MAX_CASHBACK_TIERS in packages/shared/constants/cashback-card.ts.
  /**
   * 現金回饋級距陣列（最多 5 組）.
   * Mirrors mu-plugins cashback-tier structure.
   *
   * Each tier shape:
   *   - `name` (1..40 chars): tier name shown on the pass.
   *   - `thresholdSpend` (≥ 0): cumulative spending required to qualify.
   *       0 = default tier (everyone qualifies without accumulation).
   *   - `cashbackPercent` (1..100 integer): cashback percentage.
   */
  cashbackTiers?: Array<{
    name: string;
    thresholdSpend: number;
    cashbackPercent: number;
  }>;
  // ===== Step 6 — Discount 卡 (Rule 019 § 4.1, layer 3 of 4, 2026-09-18) =====
  // Mirrors `shared/templateSettingsSchema.discountTiers`.
  // Step 6 plan 2026-09-18: discount_card variant. Each tier is a flat
  // rule of "cumulative spend → discount %". Same shape as cashback
  // tiers but semantically represents a DISCOUNT (reduces purchase
  // price) rather than CASHBACK (refund after purchase).
  //
  // Differs from cashback_card structurally:
  //   - The percent field is `discountPercent` (not `cashbackPercent`)
  //     — same numeric type, different semantic.
  //   - All other constraints are identical.
  //
  // Frontend store enforces sort order (thresholdSpend ASC, 0 first);
  // backend only validates structure and bounds. Capped at 5 tiers per
  // MAX_DISCOUNT_TIERS in packages/shared/constants/discount-card.ts.
  /**
   * 折扣級距陣列（最多 5 組）.
   *
   * Each tier shape:
   *   - `name` (1..40 chars): tier name shown on the pass.
   *   - `thresholdSpend` (≥ 0): cumulative spending required to qualify.
   *       0 = default tier (everyone qualifies without accumulation).
   *   - `discountPercent` (1..100 integer): discount percentage.
   */
  discountTiers?: Array<{
    name: string;
    thresholdSpend: number;
    discountPercent: number;
  }>;
  // ===== Step 6 — Discount 卡 expiry (Rule 019 § 4.1, layer 3 of 4, 2026-09-18) =====
  // Optional card-level expiry. Both nullable. Mutually exclusive at
  // the field handler level (UI layer concern). No card-wide toggle.
  // Mirrors the membership expiry field pattern.
  /**
   * 折扣卡自訂有效天數. 整數 [1, 3650 (10 年)].
   * 與 discountSpecificExpiryDate 互斥 (UI 層強制).
   * null = 未填 = 無到期.
   */
  discountCustomExpiryDays?: number | null;
  /**
   * 折扣卡指定到期日. ISO YYYY-MM-DD 字串.
   * 與 discountCustomExpiryDays 互斥 (UI 層強制).
   * null = 未填 = 無到期.
   */
  discountSpecificExpiryDate?: string | null;
  // ===== Step 6 — Coupon 卡 (Rule 019 § 4.1, layer 3 of 4, 2026-09-19) =====
  // Mirrors `shared/templateSettingsSchema.couponDiscountType /
  // couponDiscountAmount / couponDiscountPercent / couponIssueCount`.
  // Step 6 plan 2026-09-19: sixth card-type-specific logic editor.
  // Single flat rule (one coupon = one discount value + one issue count).
  //
  // 2026-09-19 fix (coupon persistence bug): these fields were missing
  // from the backend interface, causing Rule 019 § 4.1 layer 3 drift
  // from layer 1 (shared schema) and layer 2 (request.ts). The
  // frontend sent these fields inside `settings` but the backend
  // layer 2 + layer 3 didn't know about them, so zod stripped them
  // (zod default `.object()` strips unknown keys) and the TypeScript
  // type system didn't flag the missing fields.
  /**
   * 折價券折扣類型 (2026-09-19, coupon_card only).
   * 'amount_off' → couponDiscountAmount 生效，couponDiscountPercent 必為 null.
   * 'percent_off' → couponDiscountPercent 生效，couponDiscountAmount 必為 null.
   * 兩種 type 的 value 欄位互斥（切換時清空對方，store setter 強制）.
   * 預設 'amount_off'（user decision 2026-09-19）.
   */
  couponDiscountType?: 'amount_off' | 'percent_off' | null;
  /**
   * 折價券現金折扣金額. 僅在 couponDiscountType === 'amount_off' 時生效.
   * 整數/小數皆可，≥ COUPON_AMOUNT_MIN=1，無上限（user decision 2026-09-19）.
   * null = 切換至 percent_off 後自動清空，或使用者尚未填入.
   */
  couponDiscountAmount?: number | null;
  /**
   * 折價券 % 數折扣. 僅在 couponDiscountType === 'percent_off' 時生效.
   * 整數 ∈ [COUPON_PERCENT_MIN=1, COUPON_PERCENT_MAX=100].
   * null = 切換至 amount_off 後自動清空，或使用者尚未填入.
   */
  couponDiscountPercent?: number | null;
  /**
   * 一次發給同一消費者的折價券張數.
   * 整數 ≥ COUPON_ISSUE_COUNT_MIN=1，無上限（user decision 2026-09-19）.
   * 預設 1（單張）.
   */
  couponIssueCount?: number;
  // ===== Step 6 — Multipass 卡 (Rule 019 § 4.1, layer 3 of 4, 2026-09-19) =====
  // Mirrors `shared/templateSettingsSchema.multipassTiers` (Layer 1).
  // Step 6 plan 2026-09-19: seventh card-type-specific logic editor.
  // multipass differs structurally from stamp_card:
  //   - Stamp card has a SINGLE flat reward (one rewardName + rewardType +
  //     rewardValue + maxDiscountAmount).
  //   - Multipass card has UP TO MAX_MULTIPASS_TIERS=5 tiers, each tier
  //     carries its own name + stampsNeeded + rewardType + rewardValue.
  //   - stampsNeeded = 0 IS legitimate (= 歡迎禮「辦卡立刻送」, immediate
  //     reward on download). stampsNeeded ∈ [0, MULTIPASS_STAMPS_NEEDED_MAX=999]
  //     is purely a safety valve against typos.
  //   - stampsNeeded is COMPLETELY DECOUPLED from the Step 3 stamp grid
  //     (stampGridRows × 5). Multipass cards may stack stamps across
  //     multiple physical visit-passes onto one virtual multipass.
  //
  // The frontend store enforces the "stampsNeeded 重複警告" via a
  // soft-warning UI (deferred to PR-4); backend does NOT reject
  // duplicates — the contract is monotonic-tolerant (user spec
  // 2026-09-19, stampsNeeded 強制遞增: 不強制).
  //
  // 4-layer sync:
  //   - packages/shared/schemas/card.ts (Layer 1, single source of truth)
  //   - apps/backend/src/modules/cards/schemas/request.ts (Layer 2 mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (Layer 3 — this interface)
  //   - apps/backend/src/modules/cards/services/cardService.ts (Layer 4 — auto via Partial<TemplateSettings>)
  /**
   * Multipass 多 tier 陣列 (最多 MAX_MULTIPASS_TIERS=5 組).
   *
   * Each tier shape:
   *   - `name` (1..MULTIPASS_TIER_NAME_MAX_LENGTH=40 chars): tier name.
   *   - `stampsNeeded` (≥ 0, ≤ MULTIPASS_STAMPS_NEEDED_MAX=999): stamps
   *       required to unlock the tier reward. 0 = 歡迎禮「辦卡立刻送」
   *       (immediate reward on download). NO enforcement of monotonic
   *       order — tenant design freedom (user decision 2026-09-19).
   *   - `rewardType` ('amount_off' | 'percent_off' | null): null when
   *       user hasn't picked a type.
   *   - `rewardValue` (> 0 or null): cash amount for amount_off;
   *       percentage integer 1-100 for percent_off. null when type is null.
   */
  multipassTiers?: Array<{
    name: string;
    stampsNeeded: number;
    /**
     * Reward type ('amount_off' | 'percent_off' | null). Optional in
     * the DB interface to match the zod schema's `.nullable().optional()`
     * — the frontend may emit `undefined` when the user hasn't picked a
     * type. Mirrors `rewardValue` (also optional).
     */
    rewardType?: 'amount_off' | 'percent_off' | null;
    /**
     * Reward value (> 0 or null). Optional in the DB interface to match
     * the zod schema's `.nullable().optional()` — null means "user hasn't
     * picked a value yet"; undefined means "field not present in payload".
     */
    rewardValue?: number | null;
    /**
     * 2026-09-20 PR-6: per-tier 最高折抵金額 (rewardType === 'percent_off' 時有意義).
     * 對齊 stamp_card.maxDiscountAmount 的 per-tier 變體. Mirrors
     * `shared/templateSettingsSchema.multipassTiers[*].maxDiscountAmount`
     * (Rule 019 § 4.1 layer 3).
     * - `0` = 無上限 (使用者輸入 0)
     * - `1..MAX_DISCOUNT_AMOUNT_MAX` = 折抵上限
     * - `null` = 已清空欄位（但先前有值，使用者主動清空）
     * - `undefined` = 從未填過欄位
     */
    maxDiscountAmount?: number | null;
    /**
     * 2026-09-20 PR-5: per-tier 門檻欄位. 對齊 stamp_card card-wide
     * stampsPerVisitCount / stampsPerSpendAmount 等欄位的 per-tier 變體.
     * Mirrors `shared/templateSettingsSchema.multipassTiers[*].perVisitCount`
     * (Rule 019 § 4.1 layer 3).
     */
    perVisitCount?: number | null;
    perVisitStamps?: number | null;
    perSpendAmount?: number | null;
    perSpendStamps?: number | null;
  }>;
  /**
   * 2026-09-20 PR-5: card-wide multipass 蓋章方式. 對齊
   * stamp_card.stampAccrualMode (在 settings 內 card-wide 的 enum).
   * Mirrors `shared/templateSettingsSchema.multipassAccrualMode`
   * (Rule 019 § 4.1 layer 3).
   */
  multipassAccrualMode?: 'per_stamp' | 'per_visit' | 'per_spend' | null;
  // ===== Step 7 — 客製化桌牌 (Rule 019 § 4.1, layer 3 of 4, 2026-09-27) =====
  // Mirrors `shared/templateSettingsSchema.tableCard` (Layer 1).
  //
  // Storage strategy:
  //   - Element list + background + bleed stored in JSONB (this field).
  //   - Image elements store only the R2 KEY here (imageKey field of the
  //     element); the binary PNG lives in R2 at
  //     `{tenant_id}/{template_id}/table-card/{element_id}.png`.
  //   - The exported PNG (rasterized by frontend Konva) lives in R2 at
  //     `{tenant_id}/{template_id}/table-card-export.png`. The key +
  //     timestamp are recorded here for stale detection (Rule 030).
  //
  // The shape is intentionally identical to the shared zod schema so
  // service signatures can use `TableCardSettings` directly without a
  // separate hand-maintained type (Bug-4c lesson).
  tableCard?: {
    elements: Array<
      | {
          id: string;
          type: 'text';
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          zIndex: number;
          text: string;
          fontSize: number;
          fontWeight: 'normal' | 'bold';
          color: string;
        }
      | {
          id: string;
          type: 'image';
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          zIndex: number;
          imageKey: string;
        }
      | {
          id: string;
          type: 'shape';
          shape: 'rect' | 'circle' | 'line' | 'triangle' | 'ellipse' | 'polygon';
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          zIndex: number;
          fill: string;
          cornerRadius?: number;
          stroke?: string;
          strokeWidth?: number;
          points?: number[];
          vertexCount?: number;
        }
      // 2026-10-04 — QR Code element (Step 7 桌牌設計, Rule 019 § 4.1
      // layer 3 of 4). Mirrors `shared/tableCardElementSchema` qrcode
      // variant. QR PNGs are NOT stored in R2 — JSONB carries the
      // recipe (value, fgColor, bgColor, errorCorrectionLevel) and the
      // frontend regenerates the rasterized image on demand. See
      // `runs/decisions/2026-10-04-qrcode-library-selection.md` § 1.5
      // for the storage decision.
      | {
          id: string;
          type: 'qrcode';
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          zIndex: number;
          /** Encoded URL (e.g. `${appBaseUrl}/pass/${templateId}`). */
          value: string;
          /** Foreground hex color. */
          fgColor: string;
          /** Background hex color. */
          bgColor: string;
          /** Error correction level: L (7%) | M (15%) | Q (25%) | H (30%). */
          errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
        }
    >;
    background: {
      type: 'solid' | 'gradient';
      color?: string;
      gradient?: { from: string; to: string; angle: number };
    };
    bleedMm: 3 | 5 | 10;
    exportKey?: string;
    lastExportedAt?: string;
  };
  [key: string]: unknown;
}

/** Input for creating a new template */
export interface CreateTemplateInput {
  /** UUID. If omitted, the DB generates one via gen_random_uuid(). */
  id?: string;
  tenantId: string;
  name?: string;
  /** Card type. NULL = user has not selected a type yet. */
  cardType?: CardType;
  settings?: Partial<TemplateSettings>;
}

/** Input for updating a template */
export interface UpdateTemplateInput {
  name?: string;
  cardType?: CardType;
  settings?: Partial<TemplateSettings>;
  status?: 'draft' | 'published' | 'abandoned';
}

/**
 * Insert a new template row.
 * UUID is generated by the DB via DEFAULT gen_random_uuid().
 * expires_at is auto-set to now() + 24h (draft TTL).
 */
export async function insertTemplate(
  sql: Sql,
  input: CreateTemplateInput,
): Promise<TemplatesRow> {
  const settingsToInsert = (input.settings ?? {}) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql<TemplatesRow[]>`
    INSERT INTO templates (
      id,
      tenant_id,
      name,
      card_type,
      settings
    ) VALUES (
      ${input.id ?? sql`gen_random_uuid()`},
      ${input.tenantId},
      ${input.name ?? '未命名卡片'},
      ${input.cardType ?? null},
      ${sql.json(settingsToInsert)}
    )
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  ` as any);
  if (!rows[0]) {
    throw new Error('insertTemplate returned no rows');
  }
  return rows[0];
}

/**
 * Find a template by ID.
 * Returns undefined if not found.
 */
export async function findTemplateById(
  sql: Sql,
  id: string,
): Promise<TemplatesRow | undefined> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE id = ${id}
     LIMIT 1
  `;
  return rows[0];
}

/**
 * Find all **PUBLISHED** templates belonging to a tenant.
 *
 * Ordered by `created_at ASC, id ASC` (oldest first). CardBuilder Step 8
 * "Save & Publish" relies on this ordering so the template library shows
 * the user's templates in the order they were built. The array behaves
 * like a "stack" — when a middle template is deleted, the remaining ones
 * naturally close the gap without any `position` field or explicit
 * re-indexing.
 *
 * Tie-breaker (`id ASC`) makes the order deterministic when two templates
 * share the same `created_at` timestamp (rare but possible when many are
 * inserted in the same millisecond during automated tests).
 *
 * 2026-10-04 Step 8 plan: switched from `ORDER BY updated_at DESC` (most
 * recently edited first) to `ORDER BY created_at ASC, id ASC` (most
 * recently created first when both rows were created at the same time).
 * Why: the Template Library UX now treats creation order as the source
 * of truth for "what's at position N", so deletion naturally promotes
 * later templates forward. A `position` integer column was considered
 * and rejected — array-position semantics are simpler and don't need
 * schema changes.
 *
 * 2026-10-04 PR — `WHERE status = 'published'` filter:
 *   The Template Library preview (apps/frontend/.../TemplateLibraryGrid)
 *   renders the user's actual saved card previews. Drafts and
 *   abandoned rows are noise in that surface — a draft is the user's
 *   in-progress editor session (not a reusable template), and
 *   abandoned rows are deleted-by-user intent (rows flagged for the
 *   cleanup cron). Showing them in the library produced two regressions:
 *     1. The 2nd card in the grid mapped to an `abandoned` row whose
 *        settings were partial / null → preview rendered placeholder
 *        values ("未命名卡片" / "左欄位" / "4938591027384") instead of
 *        the user's actual saved data.
 *     2. The "second card preview" surface semantics broke because
 *        the grid position was no longer tied to a published template.
 *   Filtering at the SQL layer (single source of truth) avoids drift:
 *   the frontend `cardService.list()` doesn't need to know about the
 *   status taxonomy at all.
 *
 *   If you need an unfiltered query (e.g. for the editor's draft
 *   recovery flow), use a dedicated function (`findLatestDraftByTenant`
 *   for drafts). The list endpoint only ever serves the library, so
 *   the filter is correct at this entry point.
 */
export async function findTemplatesByTenantId(
  sql: Sql,
  tenantId: string,
): Promise<TemplatesRow[]> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE tenant_id = ${tenantId}
       AND status = 'published'
     ORDER BY created_at ASC, id ASC
  `;
  return rows;
}

/**
 * Update a template by ID.
 * Only updates fields that are explicitly provided.
 * When status is set to 'published', expires_at is automatically cleared.
 *
 * IMPORTANT: settings fields are MERGED with existing settings using JSONB's || operator
 * (PostgreSQL JSONB concatenation). This preserves existing fields that are not being
 * updated (e.g., Step 2 only updates logoText/issuerName without wiping Step 1's
 * cardType, and Step 3 only updates issuerLogo/iconImage without wiping Step 2 fields).
 *
 * Implementation note: postgres.js's tagged template injection handles the JSON string
 * safely — the right operand of || is interpolated via `${}` as a parameter, never
 * concatenated into the SQL string directly.
 *
 * Defensive unwrap of corrupted JSONB (Bug #8 + Bug #8.5 / 2026-08-31):
 * The existing `settings` column may have been corrupted by the previous REPLACE
 * bug into one of:
 *   - jsonb ARRAY of partial JSON strings (each push appended a step's payload)
 *     → NESTED unwrap: if `settings -> -1` is itself a jsonb string, parse with
 *       `((settings -> -1) #>> '{}')::jsonb`; if object, passthrough; else `'{}'`
 *       (Bug #8.5: the array tail is usually a string, NOT an object — naive
 *       `settings -> -1` returns a string and `string || object` re-corrupts)
 *   - jsonb STRING of partial JSON (legacy corruption)
 *     → unwrap with `(settings #>> '{}')::jsonb`
 *   - jsonb OBJECT (normal case)
 *     → passthrough
 * Without this defensive CASE WHEN, `corrupted_settings || new_payload` would
 * either grow the array (still corrupting) or yield a non-object type.
 */
export async function updateTemplate(
  sql: Sql,
  id: string,
  input: UpdateTemplateInput,
): Promise<TemplatesRow> {
  // Build dynamic SET clauses using tagged template injection to avoid $N collisions.
  // The id is always passed as ${id} — not as a $N positional placeholder.
  // settings is MERGED with existing settings (not replaced) so partial updates
  // never wipe unrelated fields.

  // Early return if nothing to update
  if (
    input.name === undefined &&
    input.cardType === undefined &&
    input.settings === undefined &&
    input.status === undefined
  ) {
    const existing = await findTemplateById(sql, id);
    if (!existing) {
      throw new Error('updateTemplate: template not found');
    }
    return existing;
  }

  // Build individual SET clauses via tagged template injection
  const setName = input.name !== undefined ? sql`name = ${input.name}` : null;
  const setCardType = input.cardType !== undefined ? sql`card_type = ${input.cardType}` : null;
  // Defensive unwrap: tolerate array/string corruptions in the existing settings column
  // (Bug #8 + Bug #8.5) so that `||` always sees a true jsonb object on the left side.
  // Bug #8.5 fix: WHEN 'array' branch must NESTED-unwrap the last element because
  //   legacy corruption stored `JSON.stringify(obj)` inside the array, so `settings -> -1`
  //   returns a jsonb **string**, not an object. Naive `string || object` would re-corrupt.
  const setSettings = input.settings !== undefined
    ? sql`settings = CASE jsonb_typeof(settings)
                WHEN 'object' THEN settings
                WHEN 'array'  THEN (
                  CASE jsonb_typeof(settings -> -1)
                    WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                    WHEN 'object' THEN (settings -> -1)
                    ELSE '{}'::jsonb
                  END
                )
                WHEN 'string' THEN (settings #>> '{}')::jsonb
                ELSE settings
              END || ${sql.json(input.settings as any)}`
    : null;
  const setStatus = input.status !== undefined ? sql`status = ${input.status}` : null;

  // Filter out nulls and join with commas
  const clauses = [setName, setCardType, setSettings, setStatus].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );

  const rows = await sql<TemplatesRow[]>`
    UPDATE templates
       SET ${clauses[0]}
       ${clauses.length > 1 ? sql`, ${clauses[1]}` : sql``}
       ${clauses.length > 2 ? sql`, ${clauses[2]}` : sql``}
       ${clauses.length > 3 ? sql`, ${clauses[3]}` : sql``}
     WHERE id = ${id}
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  `;

  if (!rows[0]) {
    throw new Error('updateTemplate: template not found');
  }
  return rows[0];
}

/**
 * Touch a draft template — reset its expires_at to now() + 24h to keep it alive.
 * No-op for published/abandoned templates.
 */
export async function touchExpiresAt(
  sql: Sql,
  id: string,
): Promise<TemplatesRow> {
  const rows = await sql<TemplatesRow[]>`
    UPDATE templates
       SET expires_at = now() + interval '24 hours'
     WHERE id = ${id}
       AND status = 'draft'
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  `;
  if (!rows[0]) {
    throw new Error('touchExpiresAt: template not found');
  }
  return rows[0];
}

/**
 * Find the most recent draft template for a tenant.
 * Used when user clicks "從頭建置" to check if a resume-worthy draft exists.
 * Excludes abandoned drafts.
 */
export async function findLatestDraftByTenant(
  sql: Sql,
  tenantId: string,
): Promise<TemplatesRow | null> {
  const rows = await sql<TemplatesRow[]>`
    SELECT id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
      FROM templates
     WHERE tenant_id = ${tenantId}
       AND status = 'draft'
     ORDER BY updated_at DESC
     LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Delete a template by ID.
 */
export async function deleteTemplate(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM templates WHERE id = ${id}`;
}
