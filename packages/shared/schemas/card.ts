/**
 * Card Template Schemas
 *
 * @module shared/schemas/card
 * @description Zod schemas for card builder templates.
 *
 * This file is the SINGLE SOURCE OF TRUTH for card template types.
 * Both frontend and backend MUST import from here.
 *
 * Card Types: stamp_card | cashback_card | reward_card | membership_card | discount_card | coupon_card | multipass | gift_card
 */

import { z } from 'zod';
import { CARD_FIELD_KEYS } from '../constants/card-fields';
import {
  MAX_MEMBERSHIP_TIERS,
  MAX_REWARDS_PER_TIER,
  TIER_NAME_MAX_LENGTH,
  REWARD_LABEL_MAX_LENGTH,
  REWARD_VALUE_MAX_LENGTH,
  COST_MIN,
} from '../constants/membership-card';

// ===== Card Types =====

export const cardTypeSchema = z.enum([
  'stamp_card',
  'cashback_card',
  'reward_card',
  'membership_card',
  'discount_card',
  'coupon_card',
  'multipass',
  'gift_card',
]);

export type CardType = z.infer<typeof cardTypeSchema>;

// ===== Card Display Fields (Step 3 — "顯示欄位" selector) =====

/**
 * Card face fields that can be assigned to the left/right slots.
 *
 * The list is sourced from `@saome/shared/constants/card-fields` (CARD_FIELD_KEYS)
 * so adding/removing a key only requires updating one constant. Both the
 * frontend `<Step3CardFields>` selector and the backend `templateSettingsSchema`
 * derive their enum from this single source.
 *
 * Stamp-card-specific keys (`availableRewards`, `totalStamps`,
 * `stampsRemaining`) are valid values for every card type at the schema
 * level (the enum is global), but the editor UI hides them when the user
 * picks a non-stamp card type — see `CardFieldGroup` in card-fields.ts and
 * the filter logic in `Step3CardFields/index.tsx`. Stored values are not
 * cleared on card-type churn (the conditional filter only affects the
 * dropdown options, not the store roundtrip).
 *
 * Card-type-dependent extensions beyond the 3 stamp keys are deferred to a
 * future plan; this enum ships with the six base common fields plus the
 * three stamp-only fields (see step3_card_fields_selector_baffa936.plan.md).
 */
export const cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS]);

// ===== Barcode Types =====

export const barcodeTypeSchema = z.enum(['qr_code', 'pdf_417']);

export type BarcodeType = z.infer<typeof barcodeTypeSchema>;

// ===== Currency =====

export const currencySchema = z.enum(['TWD', 'ZAR']);

export type Currency = z.infer<typeof currencySchema>;

// ===== Template Status =====

export const templateStatusSchema = z.enum(['draft', 'published', 'abandoned']);

export type TemplateStatus = z.infer<typeof templateStatusSchema>;

// ===== Template Settings (JSONB) =====

/**
 * Template settings stored in JSONB.
 * Flat structure — NOT nested.
 *
 * Step 1 fields: cardType (also held in SQL column `templates.card_type`),
 *                logoText (the text shown on the pass header — visually
 *                rendered in PassCardPreviewHeader next to the issuer logo).
 *                Card Name itself lives in the SQL column `templates.name`,
 *                NOT in this JSONB blob.
 * Step 2 fields: barcodeType, logoText, issuerName, passValidDays, expiryDate, currency
 * Step 3-4 fields: TBD (backgroundColor, textColor, etc.)
 */
export const templateSettingsSchema = z.object({
  // Step 1
  cardType: cardTypeSchema.optional(),
  // Step 2
  barcodeType: barcodeTypeSchema.optional(),
  /**
   * Logo Text — the text shown on the pass header (next to the issuer
   * logo). Semantic swap 2026-09-13: previously stored in the SQL column
   * `templates.name` under the misleading key `name`; migration 018
   * swapped it into `settings.logoText`. The Card Name (pass record name,
   * NOT shown in preview) now lives in the SQL column `templates.name`.
   */
  logoText: z.string().optional(),
  issuerName: z.string().optional(),
  passValidDays: z.number().int().positive().nullable().optional(),
  expiryDate: z.string().optional(),
  currency: currencySchema.optional(),
  // Step 3-4 (TBD)
  issuerLogo: z.string().optional(),
  /**
   * Push-notification icon (R2 key, per shared/constants/card-images.ts § 5.7 contract).
   * Stored as a string like `{tenantId}/{templateId}/icon.png` — see CARD_IMAGE_KEYS.icon.
   * Phase 5 of IconUploader plan (2026-08-31): added to support MediaAssetUploader variant="icon".
   */
  iconImage: z.string().optional(),
  /**
   * Background image (R2 key) — reserved for next BackgroundUploader plan.
   * Schema entry added now so future BackgroundUploader does not need a schema migration.
   */
  backgroundImage: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
  // ===== Step 3 — 顯示欄位 (left/right slot fields) =====
  // Step 3 plan 2026-09-04: two side-by-side native <select> dropdowns for
  // the card face. The user picks one field per slot (left/right). Card-type-
  // dependent additions/removals are deferred; current values are the six
  // base fields shared by every card type (see CARD_FIELD_KEYS in
  // packages/shared/constants/card-fields.ts).
  leftField: cardFieldKeySchema.optional(),
  rightField: cardFieldKeySchema.optional(),
  // Membership card extension
  isPaid: z.boolean().optional(),
  // ===== Step 3 — Stamp grid (集點印章) =====
  // Stamp grid feature (2026-09-04): rendered on `stamp_card` and `multipass`
  // card types only. The grid is rows × 5 columns; `stampGridRows` constrains
  // rows to 1..4. `stampIconId` references the icon manifest's id field
  // (see apps/frontend/src/assets/icons/stamps/manifest.ts).
  stampGridRows: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional(),
  stampIconId: z.string().optional(),
  // ===== Step 4 — 卡片資訊 (2026-09-04) =====
  // Description shown in PassCardPreviewBack Section 1. Required by UI but
  // left optional here so zod doesn't reject empty drafts mid-edit; the UI
  // enforces DESCRIPTION_MAX_LENGTH + non-empty via isStep4Valid().
  description: z.string().max(200).optional(),
  // Back fields shown in PassCardPreviewBack Section 4. Flat array of
  // { label, value } pairs; PassKit convention is one Label + Value per row.
  // Length min/max is enforced by UI store (BACK_FIELDS_MIN/MAX), not zod,
  // to keep schema focused on per-field validity (Rule 019 § 4.1).
  backFields: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(80),
      }),
    )
    .optional(),
  // Links shown in PassCardPreviewBack Section 5. PassKit's `links` field is
  // a separate dedicated render area distinct from `backFields`; they are
  // not interchangeable. URL validation is performed by shared/logic/links.ts
  // in the UI layer; zod only enforces max length per field (URLs can be
  // long — 2048 is the PassKit limit per pass field).
  links: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(2048),
      }),
    )
    .optional(),
  // ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) =====
  // Passcreator API-aligned fields:
  //   - `locationsDisabled`: boolean toggle. Passcreator uses this to
  //     decide whether geolocation is enabled at all. When `true` the
  //     editor collapses Step 5 and clears locations + locationsMaxDistance.
  //   - `initialMessage`: push-notification body (optional).
  //   - `locationsMaxDistance`: pass-level notification radius in meters
  //     (renamed 2026-09-06 from `notificationRadius` to align with Passcreator).
  //     `null` means "use pass-type default" (Apple Wallet decides based
  //     on card type).
  //   - `locations`: array of { name, latitude, longitude, relevantText }
  //     (added relevantText 2026-09-06; lat/lng are now REQUIRED).
  initialMessage: z.string().max(50).optional(),
  locationsDisabled: z.boolean().optional(),
  locationsMaxDistance: z
    .number()
    .int()
    .min(100)
    .max(1000)
    .nullable()
    .optional(),
  locations: z
    .array(
      z.object({
        // Per-row `name` is required (user-facing label). Length cap of 40
        // matches LOCATION_NAME_MAX_LENGTH in
        // shared/constants/card-back-fields.ts.
        name: z.string().min(1).max(40),
        // lat / lng are now REQUIRED (2026-09-06 refactor). Previously
        // optional because the editor allowed empty rows; the Step 5
        // toggle + `validateAllLocations({requireMinOne: true})` now
        // enforces non-null values at the schema layer.
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        // relevantText is the lock-screen message shown when the user
        // arrives at this location (Apple Wallet pkpass `relevantText`).
        // Optional, ≤ 100 chars, null when not set.
        relevantText: z.string().max(100).nullable().optional(),
      }),
    )
    .max(10)
    .optional(),
  // ===== Step 5 — Locations max distance (2026-09-06 rename) =====
  // DEPRECATED 2026-09-06: kept as `.optional()` for backward-compat reads
  // (Migration 017 renames DB rows from `notificationRadius` →
  // `locationsMaxDistance`). New writes should use `locationsMaxDistance`.
  // The backend silently accepts incoming `notificationRadius` but does
  // not echo it back; frontend `loadSettings` falls back to
  // `notificationRadius` if `locationsMaxDistance` is missing (defensive).
  notificationRadius: z
    .number()
    .int()
    .min(100)
    .max(1000)
    .nullable()
    .optional(),
  // ===== Step 6 — 卡片邏輯 (2026-09-07, stamp_card / multipass only) =====
  // Mirrors mu-plugins `_stamp_accrual_type` + `_stamp_reward_tiers_json`
  // (collapsed into a single tier — the active reward; mu-plugins stores
  // an array, but SAOME-REBUILD stores a single tier to keep the editor
  // simple and match the single-reward user spec 2026-09-07).
  //
  // Field-level limits live in `@saome/shared/constants/stamp-card`:
  //   - ACCRUAL_MODES / REWARD_TYPES: the enum values
  //   - REWARD_NAME_MAX_LENGTH = 40: matches PassCreator `title` cap
  //   - REWARD_VALUE bounds differ by `rewardType`:
  //       amount_off → > 0 (currency-agnostic number)
  //       percent_off → [1, 100] integer percentage
  //   - MAX_DISCOUNT_AMOUNT_MIN = 0; null means "無上限"
  //
  // Cross-references:
  //   - packages/shared/constants/stamp-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.stamp_card / .multipass)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * 蓋章模式: per_stamp (手動蓋章) / per_visit (來訪蓋章) / per_spend (消費蓋章).
   * Mirrors mu-plugins `_stamp_accrual_type` (camelCased to align with TS convention).
   * `.nullable().optional()` — null = not set (frontend store uses null for "unselected").
   */
  stampAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).nullable().optional(),
  /**
   * 獎勵名稱 (例: "10元折價活動" 或 "$10 off coupon"). Max REWARD_NAME_MAX_LENGTH=40.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].name`.
   */
  rewardName: z.string().max(40).optional(),
  /**
   * 獎勵類型: 訂單折抵現金 (amount_off) / 訂單折抵百分比 (percent_off).
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_type`.
   * `.nullable().optional()` — null = not set (frontend store uses null for "unselected").
   */
  rewardType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
  /**
   * 折抵金額 (amount_off) 或百分比整數 (percent_off).
   * Bound check is performed by `setRewardValue` setter (拒絕 ≤ 0);
   * zod uses `.positive()` as a backend double-check.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_value`.
   */
  rewardValue: z.number().positive().nullable().optional(),
  /**
   * 最高折抵金額 (僅 percent_off 模式有意義; null = 無上限).
   * zod `.nullable()` matches store's `number | null` shape (null = no ceiling).
   * Always validated as ≥ MAX_DISCOUNT_AMOUNT_MIN=0 by `setMaxDiscountAmount`.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].max_discount_amount`.
   */
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  /**
   * 來訪門檻（僅 per_visit 模式有意義）— 每 N 次拜訪可獲得 M 個蓋章。
   * stampsPerVisitCount = N（拜訪次數），stampsPerVisitStamps = M（獲得蓋章數）。
   * 2026-09-07 新增。
   */
  stampsPerVisitCount: z.number().int().min(1).nullable().optional(),
  stampsPerVisitStamps: z.number().int().min(1).nullable().optional(),
  /**
   * 消費門檻（僅 per_spend 模式有意義）— 每消費 N 元可獲得 M 個蓋章。
   * stampsPerSpendAmount = N（消費金額），stampsPerSpendStamps = M（獲得蓋章數）。
   * 2026-09-07 新增。
   */
  stampsPerSpendAmount: z.number().positive().nullable().optional(),
  stampsPerSpendStamps: z.number().int().min(1).nullable().optional(),
  // ===== Step 6 — REWARD 卡 (2026-09-09, reward_card only) =====
  // Mirrors mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php` earning mode
  // and `SAOME-Passcreator-Engine/modules/passcreator-reward-card.php` tier structure.
  //
  // 2026-09-09 mixed refactor: `earningMode` is card-wide (one mode per card),
  // but `pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints`
  // are PER-TIER (inside each `rewardTiers[*]` entry). Rationale: the earning
  // mode (visits vs spend) is a card-level policy; the earn rate (e.g.
  // 1 visit = 1 point vs 1 visit = 2 points) can differ per tier.
  //
  // rewardTiers: 最多 5 組級距（每組含 name / threshold / rewardType / rewardValue /
  // maxDiscountAmount / pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints）
  //
  // Cross-references:
  //   - packages/shared/constants/reward-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.reward_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * 整張卡片的點數累積方式 (2026-09-09, top-level).
   * one mode per card: based_on_points (自訂條件) / based_on_visits (拜訪) /
   * based_on_spending (消費). null = 未選.
   * Drives which of `pointsPerVisit` / `pointsPerSpend*` per-tier fields are
   * meaningful; switching modes via `setEarningMode` clears all per-tier
   * earn fields so no stale data leaks across modes.
   */
  earningMode: z
    .enum(['based_on_points', 'based_on_visits', 'based_on_spending'])
    .nullable()
    .optional(),
  /**
   * 獎勵級距陣列（最多 5 組）.
   * 每個 tier 包含 reward rule (name + threshold + rewardType + rewardValue +
   * maxDiscountAmount) + 對應 earning mode 的 earn rate fields
   * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints).
   *
   * 2026-09-09: `earningMode` 從 per-tier 移回 top-level。
   * Per-tier fields now only carry the earn rate (not the mode itself).
   */
  rewardTiers: z
    .array(
      z.object({
        /** 獎勵名稱 (例: "1000點折抵10%" 或 "500點折抵50元"). */
        name: z.string().min(1).max(40),
        /** 門檻點數: 需集滿 N 點才可兌換. */
        threshold: z.number().int().min(1),
        /** 獎勵類型: amount_off (現金折扣) / percent_off (百分比折扣). */
        rewardType: z.enum(['amount_off', 'percent_off']),
        /** 獎勵值: amount_off → 金額; percent_off → 百分比. */
        rewardValue: z.number().positive(),
        /** 最高折抵上限 (僅 percent_off 有意義; null = 無上限). */
        maxDiscountAmount: z.number().min(0).nullable().optional(),
        /**
         * 基於拜訪門檻（僅 card-wide earningMode === 'based_on_visits' 時使用）:
         * 此 tier 每 N 次拜訪獲得的點數. null = 未填.
         * 2026-09-09: 保留 per-tier（不同 tier 可有不同 earn rate）。
         */
        pointsPerVisit: z.number().int().min(1).nullable().optional(),
        /**
         * 基於消費門檻（僅 card-wide earningMode === 'based_on_spending' 時使用）:
         * 此 tier 每消費 N 元獲得 M 點. null = 未填.
         * 2026-09-09: 保留 per-tier.
         */
        pointsPerSpendAmount: z.number().positive().nullable().optional(),
        /**
         * 基於消費門檻（僅 card-wide earningMode === 'based_on_spending' 時使用）:
         * 此 tier 每次獲得多少點. null = 未填.
         * 2026-09-09: 保留 per-tier.
         */
        pointsPerSpendPoints: z.number().int().min(1).nullable().optional(),
      }),
    )
    .max(5)
    .optional(),
  // ===== Step 6 — Membership 卡 (2026-09-13, membership_card only) =====
  // Mirrors mu-plugins membership-tier structure (see SAOME-Email-Engine
  // membership-tier handling). The simplest Step 6 sub-module after cashback:
  // each tier is a paid/free membership level with optional duration +
  // cost + per-tier 會員獎勵 sub-rows.
  //
  // Card-wide `hasExpiry` toggle (added 2026-09-13): all tiers share the
  // same expiry setting. When false, durationType / monthlyCost / yearlyCost
  // are hidden from the UI but the underlying schema still accepts them
  // (they're optional). When true, each tier must have a non-null
  // durationType + a corresponding non-negative cost.
  //
  // Per-tier 會員獎勵 sub-rows: up to MAX_REWARDS_PER_TIER=5 per tier. Each
  // row is a {label, value} pair (same shape as Step 4 back fields / links).
  //
  // Differs structurally from stamp_card / reward_card / cashback_card:
  //   - NO earningMode switch (membership has no point accrual — the
  //     member either pays or doesn't).
  //   - NO rewardType / rewardValue (the "reward" of a membership tier
  //     IS the per-tier 會員獎勵 sub-rows, not a flat value).
  //   - NO threshold field (membership tiers are independent levels,
  //     not cumulative thresholds).
  //
  // Cross-references:
  //   - packages/shared/constants/membership-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.membership_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * Card-wide expiry toggle (2026-09-13). When `false` (default), the
   * membership tier has no expiry (e.g. lifetime VIP). When `true`, each
   * tier must specify `durationType` (monthly / yearly) + the corresponding
   * cost. Frontend store: `setHasExpiry(false)` ALSO clears all per-tier
   * `durationType` / `monthlyCost` / `yearlyCost` so no stale data leaks.
   */
  hasExpiry: z.boolean().optional(),
  /**
   * Membership tier array (最多 5 組 per MAX_MEMBERSHIP_TIERS).
   * Each tier carries name + durationType + monthlyCost + yearlyCost +
   * lifetimeCost + rewards (per-tier 會員獎勵 sub-rows, up to MAX_REWARDS_PER_TIER=5).
   *
   * Cost fields are mutually exclusive based on the card-wide `hasExpiry` toggle:
   *   - hasExpiry=true  → monthlyCost / yearlyCost are meaningful (lifetimeCost ignored).
   *   - hasExpiry=false → lifetimeCost is meaningful (monthlyCost / yearlyCost ignored).
   * The store's `setHasExpiry(false)` clears durationType but PRESERVES costs;
   * `setHasExpiry(true)` keeps the existing lifetimeCost value but it will be hidden
   * by the editor (defensive: never silently drops user-entered data).
   */
  membershipTiers: z
    .array(
      z.object({
        /** 等級名稱 (例: "VIP", "金卡會員"). Required, 1-40 chars. */
        name: z.string().min(1).max(TIER_NAME_MAX_LENGTH),
        /** 月/年卡單選. null = 未設定(僅在 card-wide hasExpiry=true 時有效). */
        durationType: z
          .enum(['monthly', 'yearly'])
          .nullable()
          .optional(),
        /** 月費. 0 = 免費會員. null = 未填. Ignored in lifetime mode (hasExpiry=false). */
        monthlyCost: z.number().min(COST_MIN).nullable().optional(),
        /** 年費. 0 = 免費會員. null = 未填. Ignored in lifetime mode (hasExpiry=false). */
        yearlyCost: z.number().min(COST_MIN).nullable().optional(),
        /**
         * 終身會員費用 (僅在 card-wide hasExpiry=false 時有效).
         * 0 = 免費終身會員. null = 未填.
         * Tenants use this field to sell the right to a lifetime tier
         * (one-time purchase). Hidden by the editor when hasExpiry=true.
         * 2026-09-13 新增: 與 monthlyCost / yearlyCost 互斥 — 由 card-wide
         * `hasExpiry` 決定哪組欄位生效.
         */
        lifetimeCost: z.number().min(COST_MIN).nullable().optional(),
        /** 會員獎勵 sub-rows (最多 5 組 per MAX_REWARDS_PER_TIER). */
        rewards: z
          .array(
            z.object({
              /** Sub-row label (e.g. "專屬優惠"). 1-20 chars. */
              label: z.string().min(1).max(REWARD_LABEL_MAX_LENGTH),
              /** Sub-row value (e.g. URL or text). 1-80 chars. */
              value: z.string().min(1).max(REWARD_VALUE_MAX_LENGTH),
            }),
          )
          .max(MAX_REWARDS_PER_TIER)
          .optional(),
      }),
    )
    .max(MAX_MEMBERSHIP_TIERS)
    .optional(),
  // ===== Step 6 — Cashback 卡 (2026-09-11, cashback_card only) =====
  // Mirrors mu-plugins cashback-tier structure. The simplest of the Step 6
  // sub-modules: each tier is a flat rule of "cumulative spend → cashback %",
  // with NO earning-mode switch and NO point accrual (the result IS a
  // percentage discount).
  //
  // Differs from reward_card structurally:
  //   - No "earningMode" field (cashback is always spend-driven).
  //   - No "rewardType / rewardValue" (cashback is always a percentage).
  //   - No "maxDiscountAmount" (cashback is a direct % rebate, not a cap'd
  //     discount).
  //   - thresholdSpend = 0 IS a legitimate "default tier" (everyone qualifies
  //     without needing to accumulate spending). This is intentional and
  //     distinguishes cashback from reward_card where threshold > 0 always.
  //
  // Cross-references:
  //   - packages/shared/constants/cashback-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.cashback_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * 現金回饋級距陣列 (最多 5 組).
   * 每個 tier 包含 name + thresholdSpend + cashbackPercent.
   *
   * 排序由前端 store 負責（thresholdSpend ASC，threshold=0 在最前）;
   * 後端只驗證結構與範圍，不強制排序。
   */
  cashbackTiers: z
    .array(
      z.object({
        /** 回饋等級名稱 (例: "VIP", "金卡會員"). Required. */
        name: z.string().min(1).max(40),
        /** 累積消費門檻 (in store currency units). 0 = 預設 tier, 人人享有. */
        thresholdSpend: z.number().min(0),
        /** 回饋%數, 整數 [1, 100]. */
        cashbackPercent: z.number().int().min(1).max(100),
      }),
    )
    .max(5)
    .optional(),
});

export type TemplateSettings = z.infer<typeof templateSettingsSchema>;

// ===== Template DTO =====

export const templateDtoSchema = z.object({
  id: z.string().uuid(),
  status: templateStatusSchema,
  name: z.string(),
  /** Card type. NULL = user has not selected a type yet. */
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TemplateDto = z.infer<typeof templateDtoSchema>;

// ===== API Payloads =====

/**
 * POST /api/cards — Create a new template draft
 *
 * id is optional: if provided, it is used as the template UUID (client-generated
 * so we can redirect to the editor immediately). If omitted, the DB generates one.
 */
export const createTemplateSchema = z.object({
  /** Client-generated UUID for immediate redirect. */
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  /** Card type. NULL = user has not selected a type yet (orphan draft). */
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
});

export type CreateTemplatePayload = z.infer<typeof createTemplateSchema>;

/**
 * PUT /api/cards/:id — Update a template
 */
export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
  status: templateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;
