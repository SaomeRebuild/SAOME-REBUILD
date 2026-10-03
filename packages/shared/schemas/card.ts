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
  MEMBERSHIP_EXPIRY_MODES,
  CUSTOM_EXPIRY_DAYS_MIN,
  CUSTOM_EXPIRY_DAYS_MAX,
} from '../constants/membership-card';
import {
  COUPON_AMOUNT_MIN,
  COUPON_PERCENT_MIN,
  COUPON_PERCENT_MAX,
  COUPON_ISSUE_COUNT_MIN,
} from '../constants/coupon-card';

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

// ===== Card Display Fields (Step 3 ??"?????" selector) =====

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
 * picks a non-stamp card type ??see `CardFieldGroup` in card-fields.ts and
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

// ===== Card Language =====

export const languageSchema = z.enum(['zh-TW', 'en']);
export type CardLanguage = z.infer<typeof languageSchema>;

// ===== Template Status =====

export const templateStatusSchema = z.enum(['draft', 'published', 'abandoned']);

export type TemplateStatus = z.infer<typeof templateStatusSchema>;

// ===== Template Settings (JSONB) =====

/**
 * Template settings stored in JSONB.
 * Flat structure ??NOT nested.
 *
 * Step 1 fields: cardType (also held in SQL column `templates.card_type`),
 *                logoText (the text shown on the pass header ??visually
 *                rendered in PassCardPreviewHeader next to the issuer logo).
 *                Card Name itself lives in the SQL column `templates.name`,
 *                NOT in this JSONB blob.
 * Step 2 fields: barcodeType, logoText, issuerName, passValidDays, expiryDate, currency
 * Step 3-4 fields: TBD (backgroundColor, textColor, etc.)
 */
// ===== Step 7 ??????????(2026-09-27) =====
//
// A4 portrait (210?297mm) canvas with user-configurable bleed (3/5/10mm).
// Frontend Konva canvas renders elements; backend rasterizes the
// exported PNG and stores it in R2 (key: `{tenantId}/{templateId}/table-card-export.png`).
//
// Element types: text, image (R2 key), shape (rect/circle/line).
// All positions/dimensions are in millimeters (mm) at the canvas
// coordinate system; the rasterizer converts to pixels at PRINT_DPI.
//
// Cross-references:
//   - packages/shared/constants/table-card.ts (single source of truth for dimensions)
//   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions table card)
//   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
//   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
//
// IMPORTANT: schema is exported at the top level so consumers can
// validate `settings.tableCard` independently (frontend autosave +
// backend export endpoint), not just as part of the full settings
// object.
//
// Note on ordering: defined BEFORE templateSettingsSchema because
// templateSettingsSchema references tableCardSettingsSchema via
// `tableCard: tableCardSettingsSchema.optional()`. JS `const` is not
// hoisted (TDZ); reversed order would throw at module load.
export const tableCardElementSchema = z.discriminatedUnion('type', [
  // ????????
  z.object({
    id: z.string().uuid(),
    type: z.literal('text'),
    /** X position from canvas top-left in mm. */
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    /** Rotation in degrees, [0, 360). */
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /** ??????? ??200 chars (matches DESCRIPTION_MAX_LENGTH). */
    text: z.string().max(200),
    /** ??? in mm (height); Konva ??????????? px. */
    fontSize: z.number().positive(),
    fontWeight: z.enum(['normal', 'bold']),
    /** Hex color 6-digit format. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  // ????????
  z.object({
    id: z.string().uuid(),
    type: z.literal('image'),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /** R2 key: `{tenantId}/{templateId}/table-card/{elementId}.png`. */
    imageKey: z.string().min(1),
    /**
     * 圖片形狀遮罩 (2026-09-27) — bounding box 仍是矩形，但 render
     * 像素裁切成 circle / triangle / rounded-rect。Konva 內建：
     *   - clipShape: 'rect' → 直接傳 cornerRadius 給 Konva.Image
     *   - clipShape: 'circle' / 'triangle' → clipFunc 繪製裁切路徑
     *
     * Backward-compatible：optional 欄位，舊資料不帶這兩個欄位時
     * 預設為「無遮罩 / 無圓角」（與既有渲染一致）。Transformer 仍
     * attach 在矩形 bounding box 上，hit-test / resize 行為不變。
     */
    clipShape: z.enum(['rect', 'circle', 'triangle']).optional(),
    /** 圓角半徑 (mm)，僅 clipShape === 'rect' 時生效。 */
    clipRadius: z.number().min(0).max(50).optional(),
  }),
  // 形狀元素 (矩形 / 圓形 / 線段 / 三角形 / 橢圓形 / 多邊形)
  z.object({
    id: z.string().uuid(),
    type: z.literal('shape'),
    /**
     * Shape kind.
     *   - rect / circle / triangle / ellipse: Konva primitive shapes
     *     (rectangle, inscribed circle, equilateral triangle, ellipse).
     *   - line: 2-point line from (0,0) to (width,height); stroke-only.
     *   - polygon: arbitrary polygon — vertex list stored in `points`
     *     (Konva flat format). The user clicks each vertex during
     *     creation mode in the canvas; the Inspector shows a "Vertex
     *     count" number input that mirrors the length of `points`.
     */
    shape: z.enum(['rect', 'circle', 'line', 'triangle', 'ellipse', 'polygon']),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    fill: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    cornerRadius: z.number().min(0).optional(),
    stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    strokeWidth: z.number().min(0).optional(),
    /**
     * Polygon 頂點 (Konva flat points format: [x1, y1, x2, y2, ...])。
     * 座標系 = element 的 local coordinate space (相對於 bbox top-left,
     * 套用 rotation 之前)。使用者建立 polygon 時 click 點擊的 canvas
     * 座標 → 減去 bbox top-left 存進 points。只有 shape === 'polygon'
     * 時才會用到;其他 shape 沒有 points 欄位。
     *
     * 順序與 `vertexCount` 保持一致 (points.length === vertexCount * 2)。
     * 變更時兩者必須同步更新 (store action 會保證)。
     */
    points: z.array(z.number()).optional(),
    /**
     * Polygon 頂點數 (僅供 debug / analytics / Inspector 顯示用,
     * 真正渲染讀 `points`)。範圍 3-12 (對應 Konva `RegularPolygon`
     * 合理上限);只在 shape === 'polygon' 時有意義。
     */
    vertexCount: z.number().int().min(3).max(12).optional(),
  }),
  // QR Code 元素 (2026-10-04, Step 7 桌牌設計)
  //
  // 即時生成的 QR Code (用 `qrcode` npm 套件, see
  // runs/decisions/2026-10-04-qrcode-library-selection.md).
  // **不**單獨存 R2 (見 plans/step_7_qr_code_*.plan.md § 1.5)—
  // 配方 (value, fgColor, bgColor, errorCorrectionLevel) 存這裡,
  // 每次 mount 由 useQrCode hook 即時生成 HTMLImageElement 給 Konva.Image。
  // 整張桌牌匯出 PNG 自動含 rasterized QR。
  //
  // 鎖 1:1：width === height (store action 在 add 時強制同步;
  // schema 沒用 refine 是因為 z.discriminatedUnion 不支援 union-level
  // refine,而 per-variant refine 在 element-level 太繞。invariant
  // 由 addTableCardElement 進入時把 element.height = element.width
  // 保證)。
  z.object({
    id: z.string().uuid(),
    type: z.literal('qrcode'),
    /** X position from canvas top-left in mm. */
    x: z.number(),
    y: z.number(),
    /** Side length in mm. width === height (lock 1:1). */
    width: z.number().positive(),
    height: z.number().positive(),
    /** Rotation in degrees, [0, 360). */
    rotation: z.number().min(0).max(360).default(0),
    zIndex: z.number().int().nonnegative(),
    /**
     * Encoded URL. Auto-generated as
     * `${env.appBaseUrl}/pass/${cardId}` when the element is added
     * (see Step7TableCardInspector). NOT user-editable — the Inspector
     * shows it as read-only preview only.
     */
    value: z.string().url(),
    /** Foreground (QR "dark" modules) hex color. default '#000000'. */
    fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
    /** Background (QR "light" modules) hex color. default '#ffffff'. */
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
    /**
     * Error correction level per QR Code spec:
     *   L =  7% (smallest modules, highest density)
     *   M = 15% (default; recommended for most uses)
     *   Q = 25% (good for outdoor / partially damaged prints)
     *   H = 30% (allows logo overlay in the QR center)
     * Source: ISO/IEC 18004:2015 § 6.5.1.
     */
    errorCorrectionLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
  }),
]);

export const tableCardBackgroundSchema = z.object({
  type: z.enum(['solid', 'gradient']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  gradient: z
    .object({
      from: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      to: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      /**
       * Gradient angle in degrees, [0, 360).
       * Convention: 0° = left→right, 90° = top→bottom, clockwise
       * (matches Photoshop / Figma). Mirrored in
       * packages/shared/logic/tableCard.ts::gradientAngleToEndPoints —
       * keep the two in sync.
       */
      angle: z.number().min(0).max(360),
    })
    .optional(),
});

export const tableCardSettingsSchema = z.object({
  /**
   * ???????????: ???? / ???? / ???. ????50 (?????.
   * Each element has x/y/width/height/rotation/zIndex.
   * zIndex 0 = bottom layer; sortByZIndex(elements) ???????
   */
  elements: z.array(tableCardElementSchema).max(50),
  /** ???????: ??? / ??. */
  background: tableCardBackgroundSchema,
  /** ???????: ??? 3mm. */
  bleedMm: z.union([z.literal(3), z.literal(5), z.literal(10)]).default(3),
  /**
   * ???????export ??R2 key.
   * ??????export endpoint ??;??? useTableCardExport hook ??????stale.
   * Optional: ???? export ??????.
   */
  exportKey: z.string().optional(),
  /** ???????export ??ISO timestamp. ??? stale ???? (Rule 030 baseline pattern). */
  lastExportedAt: z.string().optional(),
});

export const templateSettingsSchema = z.object({
  // Step 1
  cardType: cardTypeSchema.optional(),
  // Step 2
  barcodeType: barcodeTypeSchema.optional(),
  /**
   * Logo Text ??the text shown on the pass header (next to the issuer
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
  /**
   * Card display language. Controls which language the card fields are
   * translated into when sent to Passcreator (deferred ??not implemented
   * yet). Per-card property (not per-tenant) so different cards in the
   * same tenant can serve different language audiences.
   * 2026-09-18 Step 2: added for Passcreator future integration.
   */
  language: languageSchema.optional(),
  // Step 3-4 (TBD)
  issuerLogo: z.string().optional(),
  /**
   * Push-notification icon (R2 key, per shared/constants/card-images.ts ? 5.7 contract).
   * Stored as a string like `{tenantId}/{templateId}/icon.png` ??see CARD_IMAGE_KEYS.icon.
   * Phase 5 of IconUploader plan (2026-08-31): added to support MediaAssetUploader variant="icon".
   */
  iconImage: z.string().optional(),
  /**
   * Background image (R2 key) ??reserved for next BackgroundUploader plan.
   * Schema entry added now so future BackgroundUploader does not need a schema migration.
   */
  backgroundImage: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  holderName: z.string().optional(),
  cardSide: z.enum(['front', 'back']).optional(),
  // ===== Step 3 ??????? (left/right slot fields) =====
  // Step 3 plan 2026-09-04: two side-by-side native <select> dropdowns for
  // the card face. The user picks one field per slot (left/right). Card-type-
  // dependent additions/removals are deferred; current values are the six
  // base fields shared by every card type (see CARD_FIELD_KEYS in
  // packages/shared/constants/card-fields.ts).
  leftField: cardFieldKeySchema.optional(),
  rightField: cardFieldKeySchema.optional(),
  // Membership card extension
  isPaid: z.boolean().optional(),
  // ===== Step 3 ??Stamp grid (????????) =====
  // Stamp grid feature (2026-09-04): rendered on `stamp_card` and `multipass`
  // card types only. The grid is rows ? 5 columns; `stampGridRows` constrains
  // rows to 1..4. `stampIconId` references the icon manifest's id field
  // (see apps/frontend/src/assets/icons/stamps/manifest.ts).
  stampGridRows: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional(),
  stampIconId: z.string().optional(),
  // ===== Step 4 ????????? (2026-09-04) =====
  // Description shown in PassCardPreviewBack Section 1. Required by UI but
  // left optional here so zod doesn't reject empty drafts mid-edit; the UI
  // enforces DESCRIPTION_MAX_LENGTH + non-empty via isStep4Valid().
  description: z.string().max(200).optional(),
  // Back fields shown in PassCardPreviewBack Section 4. Flat array of
  // { label, value } pairs; PassKit convention is one Label + Value per row.
  // Length min/max is enforced by UI store (BACK_FIELDS_MIN/MAX), not zod,
  // to keep schema focused on per-field validity (Rule 019 ? 4.1).
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
  // long ??2048 is the PassKit limit per pass field).
  links: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.string().max(2048),
      }),
    )
    .optional(),
  // ===== Step 5 ???????? + ????? (2026-09-05, refactored 2026-09-06) =====
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
        // Optional, ??100 chars, null when not set.
        relevantText: z.string().max(100).nullable().optional(),
      }),
    )
    .max(10)
    .optional(),
  // ===== Step 5 ??Locations max distance (2026-09-06 rename) =====
  // DEPRECATED 2026-09-06: kept as `.optional()` for backward-compat reads
  // (Migration 017 renames DB rows from `notificationRadius` ??  // `locationsMaxDistance`). New writes should use `locationsMaxDistance`.
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
  // ===== Step 6 ????????? (2026-09-07, stamp_card / multipass only) =====
  // Mirrors mu-plugins `_stamp_accrual_type` + `_stamp_reward_tiers_json`
  // (collapsed into a single tier ??the active reward; mu-plugins stores
  // an array, but SAOME-REBUILD stores a single tier to keep the editor
  // simple and match the single-reward user spec 2026-09-07).
  //
  // Field-level limits live in `@saome/shared/constants/stamp-card`:
  //   - ACCRUAL_MODES / REWARD_TYPES: the enum values
  //   - REWARD_NAME_MAX_LENGTH = 40: matches PassCreator `title` cap
  //   - REWARD_VALUE bounds differ by `rewardType`:
  //       amount_off ??> 0 (currency-agnostic number)
  //       percent_off ??[1, 100] integer percentage
  //   - MAX_DISCOUNT_AMOUNT_MIN = 0; null means "??????
  //
  // Cross-references:
  //   - packages/shared/constants/stamp-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.stamp_card / .multipass)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ???????: per_stamp (????????) / per_visit (??????) / per_spend (??????).
   * Mirrors mu-plugins `_stamp_accrual_type` (camelCased to align with TS convention).
   * `.nullable().optional()` ??null = not set (frontend store uses null for "unselected").
   */
  stampAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).nullable().optional(),
  /**
   * ?????? (?? "10????????? ??"$10 off coupon"). Max REWARD_NAME_MAX_LENGTH=40.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].name`.
   */
  rewardName: z.string().max(40).optional(),
  /**
   * ??????: ????????? (amount_off) / ???????????(percent_off).
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_type`.
   * `.nullable().optional()` ??null = not set (frontend store uses null for "unselected").
   */
  rewardType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
  /**
   * ??????? (amount_off) ?????????? (percent_off).
   * Bound check is performed by `setRewardValue` setter (???? ??0);
   * zod uses `.positive()` as a backend double-check.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].reward_value`.
   */
  rewardValue: z.number().positive().nullable().optional(),
  /**
   * ???????????(??percent_off ????????? null = ??????.
   * zod `.nullable()` matches store's `number | null` shape (null = no ceiling).
   * Always validated as ??MAX_DISCOUNT_AMOUNT_MIN=0 by `setMaxDiscountAmount`.
   * Mirrors mu-plugins `_stamp_reward_tiers_json[0].max_discount_amount`.
   */
  maxDiscountAmount: z.number().min(0).nullable().optional(),
  /**
   * ?????????per_visit ??????????????N ????????? M ???????   * stampsPerVisitCount = N??????????stampsPerVisitStamps = M??????????   * 2026-09-07 ??????   */
  stampsPerVisitCount: z.number().int().min(1).nullable().optional(),
  stampsPerVisitStamps: z.number().int().min(1).nullable().optional(),
  /**
   * ?????????per_spend ?????????????????N ??????? M ???????   * stampsPerSpendAmount = N??????????stampsPerSpendStamps = M??????????   * 2026-09-07 ??????   */
  stampsPerSpendAmount: z.number().positive().nullable().optional(),
  stampsPerSpendStamps: z.number().int().min(1).nullable().optional(),
  // ===== Step 6 ??Gift Card ??(2026-09-27, gift_card only) =====
  // Prepaid model: customers pay X currency units to receive Y points;
  // points are then redeemed for in-store products at a tenant-defined
  // exchange rate. Simpler than stamp/reward cards ??single flat rule,
  // no tier list, no point accrual over time.
  //
  //   - giftCardAmount: positive integer (currency units the customer pays)
  //   - giftCardPoints: positive integer (points the customer receives)
  //
  // Default 1:1 (1 ??= 1 ?? per user decision 2026-09-27.
  // Store setter enforces `> 0` and integer; backend zod is the
  // authoritative gate on save (Rule 032 ? 1).
  giftCardAmount: z.number().int().positive().optional(),
  giftCardPoints: z.number().int().positive().optional(),
  // ===== Step 6 ??REWARD ??(2026-09-09, reward_card only) =====
  // Mirrors mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php` earning mode
  // and `SAOME-Passcreator-Engine/modules/passcreator-reward-card.php` tier structure.
  //
  // 2026-09-09 mixed refactor: `earningMode` is card-wide (one mode per card),
  // but `pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints`
  // are PER-TIER (inside each `rewardTiers[*]` entry). Rationale: the earning
  // mode (visits vs spend) is a card-level policy; the earn rate (e.g.
  // 1 visit = 1 point vs 1 visit = 2 points) can differ per tier.
  //
  // rewardTiers: ????5 ???????????name / threshold / rewardType / rewardValue /
  // maxDiscountAmount / pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints??  //
  // Cross-references:
  //   - packages/shared/constants/reward-card.ts (single source of truth)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.reward_card)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ??????????????????(2026-09-09, top-level).
   * one mode per card: based_on_points (??????) / based_on_visits (???) /
   * based_on_spending (??). null = ???.
   * Drives which of `pointsPerVisit` / `pointsPerSpend*` per-tier fields are
   * meaningful; switching modes via `setEarningMode` clears all per-tier
   * earn fields so no stale data leaks across modes.
   */
  earningMode: z
    .enum(['based_on_points', 'based_on_visits', 'based_on_spending'])
    .nullable()
    .optional(),
  /**
   * ??????????????5 ???.
   * ???tier ??? reward rule (name + threshold + rewardType + rewardValue +
   * maxDiscountAmount) + ??? earning mode ??earn rate fields
   * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints).
   *
   * 2026-09-09: `earningMode` ??per-tier ??? top-level??   * Per-tier fields now only carry the earn rate (not the mode itself).
   */
  rewardTiers: z
    .array(
      z.object({
        /** ?????? (?? "1000?????0%" ??"500?????0??). */
        name: z.string().min(1).max(40),
        /** ??????? ????? N ????????? */
        threshold: z.number().int().min(1),
        /** ??????: amount_off (???????) / percent_off (?????????. */
        rewardType: z.enum(['amount_off', 'percent_off']),
        /** ????? amount_off ??????; percent_off ???????? */
        rewardValue: z.number().positive(),
        /** ???????????(??percent_off ?????? null = ??????. */
        maxDiscountAmount: z.number().min(0).nullable().optional(),
        /**
         * ?????????????card-wide earningMode === 'based_on_visits' ???????:
         * ??tier ??N ??????????. null = ???.
         * 2026-09-09: ??? per-tier?????tier ??????? earn rate???         */
        pointsPerVisit: z.number().int().min(1).nullable().optional(),
        /**
         * ????????????card-wide earningMode === 'based_on_spending' ???????:
         * ??tier ?????N ?????M ?? null = ???.
         * 2026-09-09: ??? per-tier.
         */
        pointsPerSpendAmount: z.number().positive().nullable().optional(),
        /**
         * ????????????card-wide earningMode === 'based_on_spending' ???????:
         * ??tier ??????????? null = ???.
         * 2026-09-09: ??? per-tier.
         */
        pointsPerSpendPoints: z.number().int().min(1).nullable().optional(),
      }),
    )
    .max(5)
    .optional(),
  // ===== Step 6 ??Membership ??(2026-09-13, membership_card only) =====
  // Mirrors mu-plugins membership-tier structure (see SAOME-Email-Engine
  // membership-tier handling). The simplest Step 6 sub-module after cashback:
  // each tier is a paid/free membership level with optional duration +
  // cost + per-tier ?????? sub-rows.
  //
  // Card-wide `hasExpiry` toggle (added 2026-09-13): all tiers share the
  // same expiry setting. When false, durationType / monthlyCost / yearlyCost
  // are hidden from the UI but the underlying schema still accepts them
  // (they're optional). When true, each tier must have a non-null
  // durationType + a corresponding non-negative cost.
  //
  // Per-tier ?????? sub-rows: up to MAX_REWARDS_PER_TIER=5 per tier. Each
  // row is a {label, value} pair (same shape as Step 4 back fields / links).
  //
  // Differs structurally from stamp_card / reward_card / cashback_card:
  //   - NO earningMode switch (membership has no point accrual ??the
  //     member either pays or doesn't).
  //   - NO rewardType / rewardValue (the "reward" of a membership tier
  //     IS the per-tier ?????? sub-rows, not a flat value).
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
   * Membership tier array (????5 ??per MAX_MEMBERSHIP_TIERS).
   * Each tier carries name + durationType + monthlyCost + yearlyCost +
   * lifetimeCost + rewards (per-tier ?????? sub-rows, up to MAX_REWARDS_PER_TIER=5).
   *
   * Cost fields are mutually exclusive based on the card-wide `hasExpiry` toggle:
   *   - hasExpiry=true  ??monthlyCost / yearlyCost are meaningful (lifetimeCost ignored).
   *   - hasExpiry=false ??lifetimeCost is meaningful (monthlyCost / yearlyCost ignored).
   * The store's `setHasExpiry(false)` clears durationType but PRESERVES costs;
   * `setHasExpiry(true)` keeps the existing lifetimeCost value but it will be hidden
   * by the editor (defensive: never silently drops user-entered data).
   */
  membershipTiers: z
    .array(
      z.object({
        /** ?????? (?? "VIP", "??????"). Required, 1-40 chars. */
        name: z.string().min(1).max(TIER_NAME_MAX_LENGTH),
        /** ???????. null = ???????? card-wide hasExpiry=true ??????. */
        durationType: z
          .enum(['monthly', 'yearly'])
          .nullable()
          .optional(),
        /** ???. 0 = ??????. null = ???. Ignored in lifetime mode (hasExpiry=false). */
        monthlyCost: z.number().min(COST_MIN).nullable().optional(),
        /** ??. 0 = ??????. null = ???. Ignored in lifetime mode (hasExpiry=false). */
        yearlyCost: z.number().min(COST_MIN).nullable().optional(),
        /**
         * ??????? (??? card-wide hasExpiry=false ??????.
         * 0 = ????????. null = ???.
         * Tenants use this field to sell the right to a lifetime tier
         * (one-time purchase). Hidden by the editor when hasExpiry=true.
         * 2026-09-13 ????: ??monthlyCost / yearlyCost ?? ????card-wide
         * `hasExpiry` ??????????????.
         */
        lifetimeCost: z.number().min(COST_MIN).nullable().optional(),
        /** ?????? sub-rows (????5 ??per MAX_REWARDS_PER_TIER). */
        rewards: z
          .array(
            z.object({
              /** Sub-row label (e.g. "??????"). 1-20 chars. */
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
  // ===== Step 6 ??Free Membership Card expiry (2026-09-14) =====
  // ??????????isPaid=false??????????????????????????????
  // `durationType` + `monthlyCost` / `yearlyCost` ??????????????????????  //
  // ???????
  // - ???? durationType (monthly/yearly) + ??? cost = ???????????????
  // - ????? ???? N ??????? OR ???????????????????????
  //
  // Mirrors:
  //   - packages/shared/constants/membership-card.ts (MEMBERSHIP_EXPIRY_MODES ??
  //   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts::TemplateSettings (interface)
  /**
   * ????????????????????2026-09-14, ?????isPaid=false??
   * - 'custom_days': ???? N ?????????? membershipCustomExpiryDays??   * - 'specific_date': ??????????????membershipSpecificExpiryDate, ISO YYYY-MM-DD??   * null = ????????? hasExpiry=true ?????? hasExpiry=false ???????????????   */
  membershipExpiryMode: z.enum(MEMBERSHIP_EXPIRY_MODES).nullable().optional(),
  /**
   * ???????????????membershipExpiryMode === 'custom_days' ?????????   * ??? [CUSTOM_EXPIRY_DAYS_MIN=1, CUSTOM_EXPIRY_DAYS_MAX=3650??0???]??   * null = ?????   */
  membershipCustomExpiryDays: z
    .number()
    .int()
    .min(CUSTOM_EXPIRY_DAYS_MIN)
    .max(CUSTOM_EXPIRY_DAYS_MAX)
    .nullable()
    .optional(),
  /**
   * ????????????????membershipExpiryMode === 'specific_date' ?????????   * ISO YYYY-MM-DD ????null = ?????   * ??????min=today????? setter ???zod ?????????   */
  membershipSpecificExpiryDate: z.string().nullable().optional(),
  // ===== Step 6 ??Cashback ??(2026-09-11, cashback_card only) =====
  // Mirrors mu-plugins cashback-tier structure. The simplest of the Step 6
  // sub-modules: each tier is a flat rule of "cumulative spend ??cashback %",
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
   * ?????????????? (????5 ??.
   * ???tier ??? name + thresholdSpend + cashbackPercent.
   *
   * ??????????store ???thresholdSpend ASC?threshold=0 ????????;
   * ??????????????????????????   */
  cashbackTiers: z
    .array(
      z.object({
        /** ?????????? (?? "VIP", "??????"). Required. */
        name: z.string().min(1).max(40),
        /** ?????????(in store currency units). 0 = ??? tier, ?????. */
        thresholdSpend: z.number().min(0),
        /** ????%?? ??? [1, 100]. */
        cashbackPercent: z.number().int().min(1).max(100),
      }),
    )
    .max(5)
    .optional(),
  // ===== Step 6 ??Discount ??(2026-09-18, discount_card only) =====
  // Mirrors mu-plugins cashback-tier structure but semantically
  // represents a DISCOUNT (reduces purchase price) rather than
  // CASHBACK (refund after purchase). Same shape as cashbackTiers;
  // the percent field is `discountPercent` instead of `cashbackPercent`.
  //
  // Cross-references:
  //   - packages/shared/constants/discount-card.ts (single source of truth)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ????????? (????5 ??.
   * ???tier ??? name + thresholdSpend + discountPercent.
   *
   * ??????????store ???thresholdSpend ASC?threshold=0 ????????;
   * ??????????????????????????   */
  discountTiers: z
    .array(
      z.object({
        /** ????????? (?? "????", "VIP"). Required. */
        name: z.string().min(1).max(40),
        /** ?????????(in store currency units). 0 = ??? tier, ?????. */
        thresholdSpend: z.number().min(0),
        /** ???%?? ??? [1, 100]. */
        discountPercent: z.number().int().min(1).max(100),
      }),
    )
    .max(5)
    .optional(),
  // ===== Step 6 ??Discount ??expiry (2026-09-18, discount_card only) =====
  // Optional card-level expiry. Mirrors membership expiry pattern:
  // two nullable fields, mutually exclusive at the field handler level,
  // no card-wide toggle (no `hasDiscountExpiry` field).
  //
  // Both are nullable; null = no expiry (matches cashback card behavior).
  //
  // Cross-references:
  //   - packages/shared/constants/discount-card.ts (bounds)
  /**
   * ?????????????? ??? [DISCOUNT_CUSTOM_EXPIRY_DAYS_MIN=1,
   * DISCOUNT_CUSTOM_EXPIRY_DAYS_MAX=3650 (10 ??].
   * ??discountSpecificExpiryDate ???field handler ???????
   * null = ??? = ?????
   */
  discountCustomExpiryDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .nullable()
    .optional(),
  /**
   * ????????????. ISO YYYY-MM-DD ??.
   * ??discountCustomExpiryDays ???field handler ???????
   * null = ??? = ?????
   */
  discountSpecificExpiryDate: z.string().nullable().optional(),
  // ===== Step 6 ??Coupon ??(2026-09-19, coupon_card only) =====
  // Single flat rule (one coupon = one discount value). Unlike discount_card
  // which is tiered-cumulative-spend ??percentage, coupon card has NO tier
  // list ??just one discount type + value + issue count.
  //
  // The user picks BETWEEN amount_off and percent_off via a radio group
  // (mutually exclusive ??switching type clears the other value field).
  // `couponIssueCount` is card-level: how many coupons to issue per
  // redemption transaction (??1, no upper cap per user decision).
  //
  // Cross-references:
  //   - packages/shared/constants/coupon-card.ts (single source of truth)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * ???????????? amount_off = ????????couponDiscountAmount ??????
   * percent_off = % ???????couponDiscountPercent ??????
   * ??? type ??value ?????????????????store setter ???????
   */
  couponDiscountType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
  /**
   * ??????????????? ??? couponDiscountType === 'amount_off' ??????
   * ???/???????? rewardType=amount_off ??rewardValue ?????
   * ????COUPON_AMOUNT_MIN=1. ????????user decision 2026-09-19??
   * null = ???.
   */
  couponDiscountAmount: z.number().min(COUPON_AMOUNT_MIN).nullable().optional(),
  /**
   * ?????% ?????? ??? couponDiscountType === 'percent_off' ??????
   * ??? ??[COUPON_PERCENT_MIN, COUPON_PERCENT_MAX].
   * null = ???.
   */
  couponDiscountPercent: z
    .number()
    .int()
    .min(COUPON_PERCENT_MIN)
    .max(COUPON_PERCENT_MAX)
    .nullable()
    .optional(),
  /**
   * ????????????????????? ??? ??COUPON_ISSUE_COUNT_MIN.
   * ????????user decision 2026-09-19??
   * Default = 1.
   */
  couponIssueCount: z.number().int().min(COUPON_ISSUE_COUNT_MIN).optional(),
  // ===== Step 6 ??Multipass ??(2026-09-19, Rule 019 ? 4.1, multipass only) =====
  // Mirrors `shared/templateSettingsSchema.multipassTiers`.
  // Multipass card has UP TO 5 tiers; each tier carries name +
  // stampsNeeded + rewardType + rewardValue. Differs structurally from
  // stamp_card's single reward: stampsNeeded = 0 represents "?????  // ?????? (immediate reward on download). stampsNeeded is
  // COMPLETELY DECOUPLED from the Step 3 stamp grid (stampGridRows ? 5)
  // ??multipass cards may stack stamps across multiple physical
  // cards. Backend zod caps stampsNeeded at 999 purely as a safety
  // valve against typos (e.g. user types 99999).
  //
  // Cross-references:
  //   - packages/shared/constants/multipass-card.ts (single source of truth ??bounds)
  //   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.multipass)
  //   - apps/backend/src/modules/cards/schemas/request.ts (mirror)
  //   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
  /**
   * Multipass ??tier ??? (????MAX_MULTIPASS_TIERS=5 ??.
   * ???tier ??? name + stampsNeeded + rewardType + rewardValue.
   *
   * stampsNeeded:
   *   - 0 = ???????????????immediate reward on download)
   *   - 1..999 = ???????????????zod ???????   * ??Step 3 stamp grid ??????multipass ??????????????????????
   */
  multipassTiers: z
    .array(
      z.object({
        /** Tier name shown on the pass (e.g. "?????, "VIP ????"). 1-40 chars. */
        name: z.string().min(1).max(40),
        /** Stamps required to unlock this tier reward. 0 = welcome gift; 1..999 = design choice. */
        stampsNeeded: z.number().int().min(0).max(999),
        /** Reward type. Mirrors stamp_card rewardType. null when user hasn't picked. */
        rewardType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
        /** Discount amount (amount_off) or percentage integer 1-100 (percent_off). null when unselected. */
        rewardValue: z.number().positive().nullable().optional(),
        // ??PR-6 (2026-09-20) per-tier ???????????????? stamp_card.maxDiscountAmount.
        // 0 = ?????? 1..MAX_DISCOUNT_AMOUNT_MAX = ??????. null = ??? (= ??????.
        // ???? rewardType === 'percent_off' ???????,amount_off ????????????
        maxDiscountAmount: z.number().min(0).nullable().optional(),
        // ??PR-5 ???? per-tier ???????????? stamp_card ??card-wide
        // stampsPerVisitCount / stampsPerSpendAmount ?????? per-tier ???.
        // ??: stamp_card ??4 ????????? card-wide ???,Multipass ??        // ??? per-tier (??????? ?????????????tier ?????        // ????????????.
        /**
         * ???????????(multipassAccrualMode === 'per_visit').
         * integer ??1. null = ???.
         */
        perVisitCount: z.number().int().min(1).nullable().optional(),
        /** ???????????. integer ??1. null = ???. */
        perVisitStamps: z.number().int().min(1).nullable().optional(),
        /** ???????????? positive number ??0.01. null = ???. */
        perSpendAmount: z.number().positive().nullable().optional(),
        /** ???????????. integer ??1. null = ???. */
        perSpendStamps: z.number().int().min(1).nullable().optional(),
      }),
    )
    .max(5)
    .optional(),
  /**
   * ??????? multipass ???????? (2026-09-20 PR-5, multipass only).
   * ??? stamp_card.stampAccrualMode (??settings ??card-wide).
   * Mirrors `shared/templateSettingsSchema.stampAccrualMode` (Rule 019 ? 4.1).
   * null = ???.
   *
   * Cross-references:
   *   - packages/shared/constants/multipass-card.ts (MULTIPASS_ACCRUAL_MODES)
   *   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.multipass.multipassAccrualMode)
   *   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
   *   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
   */
  multipassAccrualMode: z.enum(['per_stamp', 'per_visit', 'per_spend']).nullable().optional(),
  // ===== Step 7 ??????????(2026-09-27) =====
  // Reference the separately-exported schema above so consumers can also
  // use it standalone for client-side validation (Rule 032 ? 2).
  tableCard: tableCardSettingsSchema.optional(),
});

// ===== Step 7 ??????????(2026-09-27) =====
//
// (See full schema docs below ??defined here so consumers can also
// validate `settings.tableCard` independently for client-side validation.)

// ===== Step 7 ??????????(2026-09-27) =====
//
// A4 portrait (210?297mm) canvas with user-configurable bleed (3/5/10mm).
// Frontend Konva canvas renders elements; backend rasterizes the
// exported PNG and stores it in R2 (key: `{tenantId}/{templateId}/table-card-export.png`).
//
// Element types: text, image (R2 key), shape (rect/circle/line).
// All positions/dimensions are in millimeters (mm) at the canvas
// coordinate system; the rasterizer converts to pixels at PRINT_DPI.
//
// Cross-references:
//   - packages/shared/constants/table-card.ts (single source of truth for dimensions)
//   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions table card)
//   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
//   - apps/backend/src/modules/cards/db/templates.ts (TemplateSettings interface)
//
// IMPORTANT: schema is exported at the top level so consumers can
// validate `settings.tableCard` independently (frontend autosave +
// backend export endpoint), not just as part of the full settings
// object. Reusing it via `templateSettingsSchema.shape.tableCard` would
// couple callers to the parent schema shape.
//
// Note on ordering: defined BEFORE templateSettingsSchema because
// templateSettingsSchema references tableCardSettingsSchema via
// `tableCard: tableCardSettingsSchema.optional()`. JS `const` is not
// hoisted (TDZ); reversed order would throw at module load.
/**
 * Card ID (optional; client-generated UUID for optimistic creation,
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
 * PUT /api/cards/:id ??Update a template
 */
export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  cardType: cardTypeSchema.optional(),
  settings: templateSettingsSchema.optional(),
  status: templateStatusSchema.optional(),
});

export type UpdateTemplatePayload = z.infer<typeof updateTemplateSchema>;

// ===== Step 7 ??Table Card inferred types (2026-09-27) =====
//
// Re-export zod-inferred types so consumers (frontend store, backend
// service signatures) can reference them without re-importing zod.
// Use `z.infer` to stay in sync with schema changes automatically.

export type TableCardTextElement = z.infer<typeof tableCardElementSchema> & {
  type: 'text';
};
export type TableCardImageElement = z.infer<typeof tableCardElementSchema> & {
  type: 'image';
};
export type TableCardShapeElement = z.infer<typeof tableCardElementSchema> & {
  type: 'shape';
};
// ===== Step 7 QR Code element (2026-10-04) =====
//
// See `tableCardElementSchema` discriminated-union variant above for
// field-by-field constraints. Inferred type is re-exported here for
// consumer ergonomics (avoids re-importing zod in components / hooks).
//
//   - Canvas: `CanvasQrCode` (apps/frontend/.../Step7TableCard/) feeds
//     `useQrCode(element.value, element.fgColor, element.bgColor,
//     element.errorCorrectionLevel)` to Konva.Image
//   - Inspector: 2× ColorSwatchPicker (fgColor / bgColor) + 1× select
//     (errorCorrectionLevel) + read-only URL preview
//   - Store: `addTableCardElement` enforces MAX_QRCODE_ELEMENTS=1 cap
//     + 1:1 invariant (`height = width`)
export type TableCardQrCodeElement = z.infer<typeof tableCardElementSchema> & {
  type: 'qrcode';
};
export type TableCardElement = z.infer<typeof tableCardElementSchema>;
export type TableCardBackground = z.infer<typeof tableCardBackgroundSchema>;
export type TableCardSettings = z.infer<typeof tableCardSettingsSchema>;

// ===== Template DTO (cross-package contract, 2026-09-27) =====
//
// `TemplateDto` is the shape returned by every card-template endpoint
// (POST/GET/PUT/DELETE). Frontend `cardService.ts` + multiple components
// import this type directly; backend `apps/backend/src/modules/cards/schemas/response.ts`
// also defines a structurally-identical interface but for cross-package
// consumption we re-export the canonical zod-inferred shape here.
//
// Per Rule 019 � 4.1 (single source of truth): the canonical fields
// (id, name, status, cardType, settings, timestamps) live in shared scope.
// Backend response.ts keeps a structural interface alias for its local
// callers (avoid breaking changes there); frontend consumers should
// import from `@saome/shared/schemas/card`.

export const templateDtoSchema = z.object({
  id: z.string().uuid(),
  status: templateStatusSchema,
  name: z.string(),
  cardType: cardTypeSchema.optional(),
  settings: z.record(z.string(), z.unknown()), // TemplateSettings ? typed loosely here
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TemplateDto = z.infer<typeof templateDtoSchema>;
