/**
 * CardBuilderEditor — Zustand Store
 */

import { create } from 'zustand';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/card';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import {
  BACK_FIELDS_MAX,
  LINKS_MAX,
  LOCATIONS_MAX,
  INITIAL_MESSAGE_MAX_LENGTH,
  LOCATION_NAME_MAX_LENGTH,
  LATITUDE_MIN,
  LATITUDE_MAX,
  LONGITUDE_MIN,
  LONGITUDE_MAX,
  RELEVANT_TEXT_MAX_LENGTH,
  LOCATIONS_MAX_DISTANCE_MIN,
  LOCATIONS_MAX_DISTANCE_MAX,
  ACCRUAL_MODES,
  REWARD_NAME_MAX_LENGTH,
  MAX_DISCOUNT_AMOUNT_MAX,
  REWARD_TIER_NAME_MAX_LENGTH,
  MAX_REWARD_TIERS,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  POINTS_PER_VISIT_MIN,
  POINTS_PER_SPEND_MIN_AMOUNT,
  POINTS_PER_SPEND_MIN_POINTS,
  MAX_DISCOUNT_AMOUNT_MIN,
  MAX_CASHBACK_TIERS,
  CASHBACK_TIER_NAME_MAX_LENGTH,
  CASHBACK_PERCENT_MIN,
  CASHBACK_PERCENT_MAX,
  CASHBACK_THRESHOLD_MIN,
  CASHBACK_THRESHOLD_MAX,
  type AccrualMode,
  type RewardType,
  type EarningMode,
  type RewardTierShape,
  type CashbackTierShape,
} from '@saome/shared/constants';
import type { LocationInput } from '@saome/shared/logic/locations';
import { normalizeHex } from '@saome/shared/logic/color';
import { unwrapCardSettings } from '@saome/shared/logic/cardSettings';

/**
 * A single { label, value } pair used by both Step 4 back fields and Step 4
 * links. Lives in shared scope is overkill for now (only consumed by this
 * store); define inline.
 */
export interface LabelValuePair {
  label: string;
  value: string;
}

/**
 * Wrap raw 6-char hex (PassCreator format) into '#FFFFFF' for store internal use.
 * Defensive: handles legacy / malformed values by falling back.
 *
 * @param raw - Value loaded from DB (e.g. 'FFFFFF' from PassCreator, or null/undefined)
 * @param fallback - Store fallback value (current state) if normalization fails
 */
function normalizeLoadedColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const normalized = normalizeHex(raw);
  return normalized ? `#${normalized}` : fallback;
}

interface CardBuilderState {
  /** Template ID（從後端建立，null = 新建模式） */
  cardId: string | null;
  /** 卡片名稱 */
  name: string;
  /** 卡片類型 */
  cardType: CardType | null;
  /** 目前步驟 */
  step: EditorStep;
  /** 已完成的步驟 */
  completedSteps: Set<EditorStep>;
  /** 卡片顯示的面 */
  cardSide: 'front' | 'back';
  /** 發卡機構名稱 */
  issuerName: string;
  /** 發卡機構標誌 */
  issuerLogo: string;
  /** issuerLogo 的版本號（用於 cache busting） */
  issuerLogoVersion: number;
  /** 推播通知 icon (R2 key per § 5.7 contract) */
  iconImage: string;
  /** iconImage 的版本號（用於 cache busting） */
  iconImageVersion: number;
  /** 卡片背景圖 (R2 key per § 5.7 contract) */
  backgroundImage: string;
  /** backgroundImage 的版本號（用於 cache busting） */
  backgroundImageVersion: number;
  /** 卡片背景色 */
  backgroundColor: string;
  /** 卡片文字色 */
  textColor: string;
  /** 持有人名稱 */
  holderName: string;

  // ===== Step 2 Base 欄位（所有卡種共用）=====
  /** Barcode 格式 */
  barcodeType: BarcodeType;
  /** 店名 */
  storeName: string;
  /** PASS 有效天數（非必填，null = 未填） */
  passValidDays: number | null;
  /** 到期日設定（非必填） */
  expiryDate: string;
  /** 貨幣選擇 */
  currency: 'TWD' | 'ZAR';

  // ===== Step 3 — 顯示欄位 (left/right slots) =====
  /**
   * Step 3 plan 2026-09-04: two side-by-side native <select> dropdowns for
   * card face fields. Both default to `null` (placeholder "請選擇" shown).
   * Persisted to `template_settings.leftField / rightField` via the existing
   * JSONB merge semantics (see apps/backend/.../db/templates.ts::updateTemplate).
   */
  leftField: CardFieldKey | null;
  rightField: CardFieldKey | null;

  // ===== Membership Card Extension =====
  /** 會員卡是否收費（僅 membership_card 使用） */
  isPaid: boolean;

  // ===== Step 3 — Stamp Grid (集點印章) =====
  /**
   * Number of rows in the stamp grid (1..4). Persisted to
   * `template_settings.stampGridRows` via the JSONB merge semantics.
   * Default `1` = smallest grid (1×5 cells).
   *
   * Only used on `stamp_card` and `multipass` card types; the Step3StampGrid
   * editor section is hidden for other types (see CardBuilderEditorWorkspace).
   */
  stampGridRows: 1 | 2 | 3 | 4;
  /**
   * Stamp icon id (e.g. `'bell'`, `'fire'`) referencing the manifest at
   * `apps/frontend/src/assets/icons/stamps/manifest.ts`. Persisted to
   * `template_settings.stampIconId`. Empty string means "no icon selected"
   * — the preview falls back to a placeholder cell, not the existing
   * CreditCard icon + name.
   */
  stampIconId: string;

  // ===== Step 4 — 卡片資訊 (2026-09-04) =====
  /**
   * Card description (PassCardPreviewBack Section 1). Max 200 chars per
   * `shared/constants/card-back-fields.DESCRIPTION_MAX_LENGTH`. Required by
   * UI but the store allows empty so drafts can be edited mid-flight; the
   * workspace `isStep4Valid()` blocks "Next" when blank.
   */
  description: string;
  /**
   * Back fields (PassCardPreviewBack Section 4). Flat array of {label, value}
   * pairs. Always ≥ 1 row (`removeBackField` refills an empty row to enforce
   * the BACK_FIELDS_MIN=1 constraint). Capped at BACK_FIELDS_MAX=10 rows;
   * `addBackField` is a no-op at the cap.
   */
  backFields: LabelValuePair[];
  /**
   * Dedicated links (PassCardPreviewBack Section 5). Flat array of
   * {label, value} pairs where `value` is a URL. **Optional** — empty array
   * is the initial state. Capped at LINKS_MAX=4; `addLink` is a no-op at
   * the cap. Unlike backFields, `removeLink` does NOT auto-refill — the
   * user can delete all rows because links are optional.
   */
  links: LabelValuePair[];

  // ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) =====
  /**
   * Push-notification body shown after the user downloads the pass
   * (Passcreator "Initial message"). Max INITIAL_MESSAGE_MAX_LENGTH=50 chars;
   * `setInitialMessage` truncates at the cap. Stored as a top-level string;
   * zod schema enforces max-length on the backend side as well.
   */
  initialMessage: string;
  /**
   * Pass-level toggle controlling whether geolocation push-notifications are
   * enabled for this pass (Passcreator API `locationsDisabled` field).
   *
   *   - `false` (default): geolocation enabled — at least 1 location row +
   *     locationsMaxDistance required to advance past Step 5.
   *   - `true`: geolocation disabled — Step 5 collapses to a single toggle
   *     + helper text; `setLocationsDisabled(true)` ALSO clears `locations`
   *     and `locationsMaxDistance` to keep DB clean (no stale data).
   *
   * 2026-09-06 refactor: renamed from no toggle (Step 5 was always
   * skippable) → boolean toggle.
   */
  locationsDisabled: boolean;
  /**
   * Pass-level notification radius in meters (Passcreator
   * `locationsMaxDistance` field). Per Apple Wallet / PassKit spec: must be
   * an integer in [LOCATIONS_MAX_DISTANCE_MIN=100, LOCATIONS_MAX_DISTANCE_MAX=1000].
   * `null` means "use pass-type default" (Apple Wallet decides based on
   * the card type; event/boarding → up to 1000 m, coupon/store/membership
   * → up to 100 m). The setter clamps to [100, 1000] and coerces
   * non-integer to integers (Round to nearest). `null` is always valid
   * (user clears the field → restore pass-type default).
   *
   * 2026-09-06 rename: was `notificationRadius`. Renamed to align with
   * Passcreator API field name.
   */
  locationsMaxDistance: number | null;
  /**
   * Geolocation triggers for the pass (Step 5 — Locations). Array of
   * {name, latitude, longitude, relevantText}. **Optional** when
   * `locationsDisabled=true` (whole Step 5 skipped). When enabled, at
   * least 1 row is required (enforced by `isStep5Valid()` +
   * `validateAllLocations({requireMinOne: true})`).
   *
   * Capped at LOCATIONS_MAX=10; `addLocation` is a no-op at the cap.
   * `removeLocation` does NOT auto-refill (matches `removeLink` semantics —
   * locations are optional when disabled). 2026-09-06 refactor: row shape
   * gained `relevantText` (≤ RELEVANT_TEXT_MAX_LENGTH=100 chars, optional);
   * lat/lng are now REQUIRED when the row exists.
   */
  locations: LocationInput[];

  // Actions
  setCardId: (cardId: string | null) => void;
  setName: (name: string) => void;
  setCardType: (cardType: CardType | null) => void;
  setStep: (step: EditorStep) => void;
  setCompletedStep: (step: EditorStep) => void;
  setCardSide: (side: 'front' | 'back') => void;
  setIssuerName: (issuerName: string) => void;
  setIssuerLogo: (issuerLogo: string) => void;
  setIconImage: (iconImage: string) => void;
  setBackgroundImage: (backgroundImage: string) => void;
  setBackgroundColor: (backgroundColor: string) => void;
  setTextColor: (textColor: string) => void;
  setHolderName: (holderName: string) => void;
  setBarcodeType: (barcodeType: BarcodeType) => void;
  setStoreName: (storeName: string) => void;
  setPassValidDays: (passValidDays: number | null) => void;
  setExpiryDate: (expiryDate: string) => void;
  setCurrency: (currency: 'TWD' | 'ZAR') => void;
  /**
   * Set the left-slot display field. Pass `null` to clear (shows placeholder).
   * `rightField` is NOT auto-cleared — dedup is enforced in the UI layer by
   * disabling the matching option on the other select.
   */
  setLeftField: (field: CardFieldKey | null) => void;
  /** Set the right-slot display field. See `setLeftField` for behavior. */
  setRightField: (field: CardFieldKey | null) => void;
  setIsPaid: (isPaid: boolean) => void;
  /**
   * Set the number of stamp grid rows (1..4). Out-of-range values are
   * rejected by the shared zod schema on save, but the setter accepts any
   * number so the editor UI can use the underlying <select> without
   * round-tripping through zod on every keystroke.
   */
  setStampGridRows: (rows: 1 | 2 | 3 | 4) => void;
  /** Set the stamp icon id (manifest id). Empty string = no icon. */
  setStampIconId: (iconId: string) => void;
  // ===== Step 4 setters =====
  /** Set the card description (max DESCRIPTION_MAX_LENGTH=200 enforced at zod save). */
  setDescription: (description: string) => void;
  /** Update one back-field row's label. */
  setBackFieldsLabel: (idx: number, label: string) => void;
  /** Update one back-field row's value. */
  setBackFieldsValue: (idx: number, value: string) => void;
  /**
   * Append one empty back-field row. No-op when `backFields.length` is
   * already at BACK_FIELDS_MAX — the UI button is also disabled at the cap
   * for double-belt-and-suspenders behavior.
   */
  addBackField: () => void;
  /**
   * Remove the row at `idx`. If the array would drop below BACK_FIELDS_MIN=1,
   * refills an empty row in place — keeps the UI always showing at least one
   * editable row.
   */
  removeBackField: (idx: number) => void;
  /** Update one link row's label. */
  setLinksLabel: (idx: number, label: string) => void;
  /** Update one link row's value. */
  setLinksValue: (idx: number, value: string) => void;
  /**
   * Append one empty link row. No-op when `links.length` is already at
   * LINKS_MAX=4 — the UI button is also disabled at the cap.
   */
  addLink: () => void;
  /**
   * Remove the link row at `idx`. Does NOT refill — links are optional,
   * the user is allowed to delete all rows.
   */
  removeLink: (idx: number) => void;
  // ===== Step 5 setters (2026-09-05, refactored 2026-09-06) =====
  /**
   * Set the push-notification initial message. Truncates at
   * INITIAL_MESSAGE_MAX_LENGTH so the user cannot type past the cap.
   */
  setInitialMessage: (message: string) => void;
  /**
   * Toggle the geolocation-push-notification feature. When transitioning
   * from enabled (false) → disabled (true), the setter ALSO clears
   * `locations` and `locationsMaxDistance` so the DB has no stale data
   * (per user spec 2026-09-06: "勾選時清空 locations + locationsMaxDistance").
   *
   * Going disabled → enabled does NOT auto-populate fields — the user
   * must add at least 1 location row + set `locationsMaxDistance` before
   * the workspace `isStep5Valid()` lets them advance.
   */
  setLocationsDisabled: (disabled: boolean) => void;
  /**
   * Set the locations max distance. Clamps to [100, 1000] (integer). Pass
   * `null` to clear → use pass-type default. `null` is always valid.
   *
   * 2026-09-06 rename: was `setNotificationRadius`.
   */
  setLocationsMaxDistance: (radius: number | null) => void;
  /** Update one location row's `name` (max LOCATION_NAME_MAX_LENGTH chars). */
  setLocationName: (idx: number, name: string) => void;
  /**
   * Update one location row's `latitude`. NaN / out-of-range values are
   * accepted here so the user can type freely; the shared zod schema on
   * save is the authoritative gate.
   */
  setLocationLatitude: (idx: number, latitude: number) => void;
  /** Update one location row's `longitude`. */
  setLocationLongitude: (idx: number, longitude: number) => void;
  /**
   * Update one location row's `relevantText` (lock-screen message).
   * 2026-09-06 added this field; max RELEVANT_TEXT_MAX_LENGTH=100 chars.
   * `null` clears the field.
   */
  setLocationRelevantText: (idx: number, relevantText: string | null) => void;
  /**
   * Append one empty location row. No-op when `locations.length` is
   * already at LOCATIONS_MAX=10 — the UI button is also disabled at the cap.
   */
  addLocation: () => void;
  /**
   * Remove the location row at `idx`. Does NOT refill — locations are
   * optional when `locationsDisabled=true`. When `locationsDisabled=false`
   * the workspace enforces "≥ 1 row" via `isStep5Valid()` instead.
   */
  removeLocation: (idx: number) => void;

  // ===== Step 6 — 集點卡邏輯 (2026-09-07, stamp_card / multipass only) =====
  // UI dispatcher (`Step6CardLogic`) conditionally renders stamp-card editor
  // when `cardType === 'stamp_card' | 'multipass'`. All other card types
  // see a ComingSoon placeholder. Values persist to template_settings via the
  // standard onNext save path in CardBuilderEditorWorkspace.
  //
  // Guards:
  //   - `setRewardType` clears `rewardValue` and `maxDiscountAmount` when
  //     type changes (amount vs percent have different valid ranges).
  //   - `setRewardValue` rejects ≤ 0 (backend zod `.positive()` is the
  //     double-check on save).
  //   - `setMaxDiscountAmount` clamps to [0, MAX_DISCOUNT_AMOUNT_MAX].
  /** 蓋章方式: per_stamp (手動) / per_visit (來訪) / per_spend (消費). null = 未選. */
  stampAccrualMode: AccrualMode | null;
  /** 獎勵名稱 (例: "10元折價活動"). max 40 chars enforced by `setRewardName`. */
  rewardName: string;
  /** 獎勵類型: amount_off (固定金額) / percent_off (百分比). null = 未選. */
  rewardType: RewardType | null;
  /** 折抵值 (amount_off → 金額; percent_off → 百分比整數). null = 未填. */
  rewardValue: number | null;
  /** 最高折抵上限 (僅 percent_off 有意義). null = 無上限. */
  maxDiscountAmount: number | null;
  /** 來訪門檻 — 每 N 次拜訪可獲得 M 個蓋章. stampsPerVisitCount ∈ [1, ∞). */
  stampsPerVisitCount: number | null;
  /** 來訪門檻 — stampsPerVisitStamps ∈ [1, ∞). */
  stampsPerVisitStamps: number | null;
  /** 消費門檻 — 每消費 N 元可獲得 M 個蓋章. stampsPerSpendAmount > 0. */
  stampsPerSpendAmount: number | null;
  /** 消費門檻 — stampsPerSpendStamps ∈ [1, ∞). */
  stampsPerSpendStamps: number | null;

  /** 設定蓋章方式. null = 未選. */
  setStampAccrualMode: (mode: AccrualMode | null) => void;
  /** 設定獎勵名稱. Truncates at REWARD_NAME_MAX_LENGTH=40. */
  setRewardName: (name: string) => void;
  /**
   * 設定獎勵類型. 順便清空 `rewardValue` 和 `maxDiscountAmount`
   * （type 變了之後舊值不合新規範圍）。
   */
  setRewardType: (type: RewardType | null) => void;
  /**
   * 設定折抵值. Rejects ≤ 0 — returns early without updating state.
   * Backend zod `.positive()` is the authoritative gate on save.
   */
  setRewardValue: (value: number | null) => void;
  /** 設定最高折抵上限. null = 無上限. Clamps to [0, MAX_DISCOUNT_AMOUNT_MAX]. */
  setMaxDiscountAmount: (amount: number | null) => void;
  /** 設定來訪門檻（拜訪次數）. Rejects ≤ 0. null = 未填. */
  setStampsPerVisitCount: (count: number | null) => void;
  /** 設定來訪門檻（獲得蓋章數）. Rejects ≤ 0. null = 未填. */
  setStampsPerVisitStamps: (stamps: number | null) => void;
  /** 設定消費門檻（消費金額）. Rejects ≤ 0. null = 未填. */
  setStampsPerSpendAmount: (amount: number | null) => void;
  /** 設定消費門檻（獲得蓋章數）. Rejects ≤ 0. null = 未填. */
  setStampsPerSpendStamps: (stamps: number | null) => void;

  // ===== Step 6 — REWARD 卡邏輯 (2026-09-09 mixed refactor) =====
  // UI dispatcher (`Step6CardLogic`) conditionally renders reward-card editor
  // when `cardType === 'reward_card'`. Other card types see ComingSoon.
  // Differs from stamp_card:
  //   - EarningModeField is CARD-WIDE (one mode per card, matches StampCardLogic's
  //     StampAccrualModeField pattern).
  //   - Up to 5 reward tiers, each tier can have its own earn rate (e.g.
  //     tier-1 = 1 visit = 1 point; tier-2 = 1 visit = 2 points).
  //   - Each tier's PointsPerVisitField / PointsPerSpendField reads top-level
  //     `earningMode` to decide whether to render (conditional on card-wide mode).
  //
  // 2026-09-09 mixed refactor: earningMode moved BACK to top-level (was per-tier
  // earlier in the day). `pointsPerVisit` / `pointsPerSpendAmount` /
  // `pointsPerSpendPoints` stay per-tier. `setEarningMode` clears ALL per-tier
  // earn fields on mode change so no stale data leaks across modes.
  //
  // Guards:
  //   - `setEarningMode` clears all per-tier earn fields when mode changes
  //     (different modes have different meaningful fields).
  //   - `addRewardTier` is no-op at MAX_REWARD_TIERS=5 (matches backend schema cap).
  //   - `removeRewardTier` does NOT auto-refill (a 0-tier state is valid for draft).
  //   - `updateRewardTier` does NOT re-sort (callers must invoke `sortRewardTiers`
  //     explicitly before saving — keeps optimistic local edits unsorted until done).
  //   - `updateRewardTier` switching rewardType clears rewardValue +
  //     maxDiscountAmount (different valid ranges).
  //   - `updateRewardTier` rejects ≤ 0 for points fields (backend zod
  //     `.int().min(1)` is the authoritative gate on save).
  /** 整張卡片的點數累積方式 (2026-09-09, top-level). null = 未選. */
  earningMode: EarningMode | null;

  /**
   * 設定整張卡片的點數累積方式.
   * 切換模式時清空所有 per-tier earn fields (pointsPerVisit /
   * pointsPerSpendAmount / pointsPerSpendPoints) 以避免 stale data.
   */
  setEarningMode: (mode: EarningMode | null) => void;

  /** 獎勵級距陣列（最多 5 組）. Empty array = 尚未新增 tier. */
  rewardTiers: Array<RewardTierShape & { id: string }>;

  /** 新增一組空白的獎勵級距. 在 MAX_REWARD_TIERS=5 時為 no-op. */
  addRewardTier: () => void;
  /** 移除指定 id 的獎勵級距. 不會自動 refill. */
  removeRewardTier: (id: string) => void;
  /** 更新指定 id 的獎勵級距（partial patch）. */
  updateRewardTier: (id: string, patch: Partial<RewardTierShape>) => void;
  /** 依 threshold 由小到大排序（存檔前自動呼叫). */
  sortRewardTiers: () => void;

  // ===== Step 6 — Cashback 卡邏輯 (2026-09-11, cashback_card only) =====
  // UI dispatcher (`Step6CardLogic`) conditionally renders cashback-card editor
  // when `cardType === 'cashback_card'`. Simplest of the three Step 6
  // sub-modules: each tier is a flat rule of "cumulative spend → cashback %".
  // No earning-mode switch, no point accrual, no rewardType/rewardValue
  // (the result IS a percentage discount).
  //
  // Differs from reward_card:
  //   - No `earningMode` (cashback is always spend-driven).
  //   - No `rewardType / rewardValue / maxDiscountAmount`.
  //   - thresholdSpend = 0 IS a legitimate "default tier" (everyone qualifies
  //     without needing to accumulate spending).
  //
  // Guards:
  //   - `addCashbackTier` is no-op at MAX_CASHBACK_TIERS=5 (matches backend schema cap).
  //   - `removeCashbackTier` does NOT auto-refill (0-tier is valid for draft).
  //   - `updateCashbackTier` rejects name > CASHBACK_TIER_NAME_MAX_LENGTH chars.
  //   - `updateCashbackTier` rejects cashbackPercent < CASHBACK_PERCENT_MIN or > CASHBACK_PERCENT_MAX.
  //   - `updateCashbackTier` rejects thresholdSpend < 0 (but allows 0 as legitimate default).
  //   - `sortCashbackTiers` orders by thresholdSpend ASC (threshold=0 first).
  /** 現金回饋級距陣列（最多 5 組）. Empty array = 尚未新增 tier. */
  cashbackTiers: Array<CashbackTierShape & { id: string }>;

  /** 新增一組空白現金回饋級距. 在 MAX_CASHBACK_TIERS=5 時為 no-op. */
  addCashbackTier: () => void;
  /** 移除指定 id 的現金回饋級距. 不會自動 refill. */
  removeCashbackTier: (id: string) => void;
  /** 更新指定 id 的現金回饋級距（partial patch）. */
  updateCashbackTier: (id: string, patch: Partial<CashbackTierShape>) => void;
  /** 依 thresholdSpend 由小到大排序（存檔前自動呼叫，threshold=0 在最前). */
  sortCashbackTiers: () => void;

  /**
   * 從既有 template 的 settings 載入 store.
   *
   * Defensive: Bug #8.5 — settings may be:
   *   - Partial<TemplateSettings> (normal)
   *   - JSON string (legacy corruption)
   *   - Array of partial merges (Bug #8 partial fix)
   *   - Array of jsonb strings (Bug #8.5 worst case)
   *
   * Accepts `unknown` because the helper handles all cases at runtime.
   */
  loadSettings: (settings: unknown) => void;
  reset: () => void;
}

/**
 * Defensive parser for `templates.settings` JSONB — now sourced from
 * `packages/shared/logic/cardSettings.ts` (Plan Phase 5.7). Backend's
 * `apps/backend/src/modules/cards/services/cardService.ts` imports the
 * same function, so behavior is guaranteed identical across layers.
 *
 * @see packages/shared/logic/cardSettings.ts
 * @see packages/shared/logic/cardSettings.test.ts (10 case contract)
 */
// unwrapCardSettings now imported from @saome/shared/logic/cardSettings

/**
 * Defensive parser for arrays of `{ label, value }` pairs (Step 4 back
 * fields & links). Returns the cleaned array on success, `fallback` when
 * the input is missing or malformed.
 *
 * Truncates to `maxLen` so a corrupted DB row with > 10 back fields
 * cannot blow up the UI editor. Each entry is coerced to `{ label: string,
 * value: string }`; any non-object entry is replaced with an empty pair.
 */
function sanitizeLabelValueArray(
  raw: unknown,
  current: LabelValuePair[],
  maxLen: number,
  fallback: LabelValuePair[],
): LabelValuePair[] {
  if (!Array.isArray(raw)) return fallback;
  const trimmed: LabelValuePair[] = [];
  for (const entry of raw.slice(0, maxLen)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      trimmed.push({
        label: typeof obj.label === 'string' ? obj.label : '',
        value: typeof obj.value === 'string' ? obj.value : '',
      });
    } else {
      trimmed.push({ label: '', value: '' });
    }
  }
  // Honor `current` only when the cleaned array is empty AND `current`
  // already had rows — i.e. don't wipe user-typed-but-unsaved data on a
  // re-load that happens to omit the field. For our two callers this is
  // moot (current always starts with at least the initial state row), but
  // it documents the intent.
  return trimmed.length > 0 ? trimmed : (current.length > 0 ? current : fallback);
}

/**
 * Defensive parser for the Step 5 `locations` array (Rule 019 + Rule 032).
 *
 * - Truncates to `LOCATIONS_MAX` so a corrupted DB row with > 10 entries
 *   cannot blow up the UI editor.
 * - Each entry is coerced to `{name, latitude, longitude, relevantText}`.
 *   Numeric fields are validated against the shared constants' bounds;
 *   out-of-range values are dropped (the row is skipped, treating it as if
 *   the user just hadn't typed them yet — falls back to `NaN` for
 *   incomplete paste handling).
 * - `name` falls back to '' (user-typing default).
 * - `relevantText` falls back to `null` (no custom lock-screen message).
 *
 * Rule 032 rationale: a malicious or corrupted DB row with bad lat/lng
 * MUST NOT propagate to the editor — otherwise the next autosave PUT
 * would clobber the DB with the same bad values. Sanitizing at load-time
 * pins the defensive contract; the store only ever holds well-typed data.
 */
function sanitizeLocations(
  raw: unknown,
  current: LocationInput[],
): LocationInput[] {
  if (!Array.isArray(raw)) return current;
  const trimmed: LocationInput[] = [];
  for (const entry of raw.slice(0, LOCATIONS_MAX)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const name =
      typeof obj.name === 'string' ? obj.name.slice(0, LOCATION_NAME_MAX_LENGTH) : '';
    const lat = typeof obj.latitude === 'number' ? obj.latitude : Number.NaN;
    const lng = typeof obj.longitude === 'number' ? obj.longitude : Number.NaN;
    // relevantText: nullable string, ≤ RELEVANT_TEXT_MAX_LENGTH chars.
    // Anything non-string (number, object, etc.) is coerced to null.
    const rawText = obj.relevantText;
    let relevantText: string | null = null;
    if (typeof rawText === 'string') {
      relevantText = rawText.slice(0, RELEVANT_TEXT_MAX_LENGTH);
    } else if (rawText === null) {
      relevantText = null;
    }
    // Reject lat/lng outside WGS84 bounds — defensive against corruption.
    if (
      !Number.isFinite(lat) ||
      lat < LATITUDE_MIN ||
      lat > LATITUDE_MAX ||
      !Number.isFinite(lng) ||
      lng < LONGITUDE_MIN ||
      lng > LONGITUDE_MAX
    ) {
      // Skip the row entirely; the rest of the array survives. This avoids
      // showing the user a half-edited location they can't fix easily.
      continue;
    }
    trimmed.push({ name, latitude: lat, longitude: lng, relevantText });
  }
  return trimmed;
}

/**
 * Defensive parser for the Step 5 `initialMessage` string. Coerces
 * anything non-string to '' and truncates at the cap.
 */
function sanitizeInitialMessage(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  return raw.slice(0, INITIAL_MESSAGE_MAX_LENGTH);
}

const initialState = {
  cardId: null,
  name: '',
  cardType: null,
  step: 1 as EditorStep,
  completedSteps: new Set<EditorStep>(),
  cardSide: 'front' as const,
  issuerName: '',
  issuerLogo: '',
  issuerLogoVersion: 0,
  iconImage: '',
  iconImageVersion: 0,
  backgroundImage: '',
  backgroundImageVersion: 0,
  backgroundColor: '#ffffff',
  textColor: '#000000',
  holderName: '',

  // ===== Step 2 Base =====
  barcodeType: 'qr_code' as BarcodeType,
  storeName: '',
  passValidDays: null,
  expiryDate: '',
  currency: 'TWD' as const,

  // ===== Step 3 — 顯示欄位 =====
  leftField: null,
  rightField: null,

  // ===== Membership Card Extension =====
  isPaid: false,

  // ===== Step 3 — Stamp Grid =====
  stampGridRows: 1 as 1 | 2 | 3 | 4,
  stampIconId: '',

  // ===== Step 4 — 卡片資訊 =====
  description: '',
  // Back fields: always ≥ 1 row (BACK_FIELDS_MIN=1 enforced by UI). Initial
  // state seeds one empty row so the first-render UI already shows an
  // editable input.
  backFields: [{ label: '', value: '' }],
  // Links: optional — empty initial array. UI shows "新增連結" button at first render.
  links: [],
  // ===== Step 5 — 地理位置 + 推播訊息 (2026-09-05, refactored 2026-09-06) =====
  initialMessage: '',
  // Locations disabled toggle: default false (geolocation enabled).
  // When true, the Step 5 editor collapses and the user can advance
  // past Step 5 without filling any fields.
  locationsDisabled: false,
  // Locations max distance: null = use pass-type default (Apple Wallet
  // decides based on card type). 2026-09-06 rename from notificationRadius.
  locationsMaxDistance: null,
  // Locations: optional — empty initial array. UI shows "新增地點" button
  // at first render; addLocation appends, removeLocation deletes (no refill).
  // Each row shape: {name, latitude, longitude, relevantText}.
  locations: [],

  // ===== Step 6 — 集點卡邏輯 (2026-09-07) =====
  // Defaults: all null/empty — user must fill in before advancing.
  stampAccrualMode: null,
  rewardName: '',
  rewardType: null,
  rewardValue: null,
  maxDiscountAmount: null,
  // Accrual thresholds (2026-09-07)
  stampsPerVisitCount: null,
  stampsPerVisitStamps: null,
  stampsPerSpendAmount: null,
  stampsPerSpendStamps: null,
  // ===== Step 6 — REWARD 卡邏輯 (2026-09-09 mixed refactor) =====
  // Defaults: earningMode=null (user must pick before adding tiers).
  // rewardTiers is empty array (user adds tiers via "新增獎勵級距" button).
  // Per-tier earn rate fields (pointsPerVisit / pointsPerSpend*) default to
  // null inside each new tier — the user fills them after picking the mode.
  earningMode: null,
  rewardTiers: [],
  // ===== Step 6 — Cashback 卡邏輯 (2026-09-11) =====
  // cashbackTiers is empty array (user adds tiers via "新增回饋級距" button).
  // Each tier: name + thresholdSpend (0 allowed = default tier) + cashbackPercent.
  cashbackTiers: [],
};

/**
 * Type-annotated initial state. The bare object literal widens `stampGridRows: 1`
 * to `number`; this explicit const preserves the union `1 | 2 | 3 | 4`.
 */
const typedInitialState: Pick<
  CardBuilderState,
  keyof typeof initialState
> = initialState;

export const useCardBuilderStore = create<CardBuilderState>((set) => ({
  ...typedInitialState,

  setCardId: (cardId) => set({ cardId }),
  setName: (name) => set({ name }),
  setCardType: (cardType) => set({ cardType }),
  setStep: (step) => set({ step }),
  setCompletedStep: (step) => set((state) => ({
    completedSteps: new Set([...state.completedSteps, step]),
  })),
  setCardSide: (cardSide) => set({ cardSide }),
  setIssuerName: (issuerName) => set({ issuerName }),
  setIssuerLogo: (issuerLogo) => set({ issuerLogo, issuerLogoVersion: Date.now() }),
  setIconImage: (iconImage) => set({ iconImage, iconImageVersion: Date.now() }),
  setBackgroundImage: (backgroundImage) => set({ backgroundImage, backgroundImageVersion: Date.now() }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setTextColor: (textColor) => set({ textColor }),
  setHolderName: (holderName) => set({ holderName }),
  setBarcodeType: (barcodeType) => set({ barcodeType }),
  setStoreName: (storeName) => set({ storeName }),
  setPassValidDays: (passValidDays) => set({ passValidDays }),
  setExpiryDate: (expiryDate) => set({ expiryDate }),
  setCurrency: (currency) => set({ currency }),
  setLeftField: (leftField) => set({ leftField }),
  setRightField: (rightField) => set({ rightField }),
  setIsPaid: (isPaid) => set({ isPaid }),
  setStampGridRows: (stampGridRows) => set({ stampGridRows }),
  setStampIconId: (stampIconId) => set({ stampIconId }),

  // ===== Step 4 setters =====
  setDescription: (description) => set({ description }),
  setBackFieldsLabel: (idx, label) =>
    set((state) => ({
      backFields: state.backFields.map((row, i) =>
        i === idx ? { ...row, label } : row,
      ),
    })),
  setBackFieldsValue: (idx, value) =>
    set((state) => ({
      backFields: state.backFields.map((row, i) =>
        i === idx ? { ...row, value } : row,
      ),
    })),
  addBackField: () =>
    set((state) => {
      if (state.backFields.length >= BACK_FIELDS_MAX) return {};
      return {
        backFields: [...state.backFields, { label: '', value: '' }],
      };
    }),
  removeBackField: (idx) =>
    set((state) => {
      const next = state.backFields.filter((_, i) => i !== idx);
      // BACK_FIELDS_MIN=1 — refill an empty row if the user just emptied
      // the array, so the editor stays usable (Apple EULA requires contact
      // info, so the user can never truly have 0 rows).
      if (next.length === 0) {
        return { backFields: [{ label: '', value: '' }] };
      }
      return { backFields: next };
    }),
  setLinksLabel: (idx, label) =>
    set((state) => ({
      links: state.links.map((row, i) =>
        i === idx ? { ...row, label } : row,
      ),
    })),
  setLinksValue: (idx, value) =>
    set((state) => ({
      links: state.links.map((row, i) =>
        i === idx ? { ...row, value } : row,
      ),
    })),
  addLink: () =>
    set((state) => {
      if (state.links.length >= LINKS_MAX) return {};
      return { links: [...state.links, { label: '', value: '' }] };
    }),
  removeLink: (idx) =>
    set((state) => ({
      // No auto-refill — links are optional, user can delete all rows.
      links: state.links.filter((_, i) => i !== idx),
    })),

  // ===== Step 5 setters (2026-09-05, refactored 2026-09-06) =====
  setInitialMessage: (message) =>
    set({
      initialMessage: message.slice(0, INITIAL_MESSAGE_MAX_LENGTH),
    }),
  setLocationsDisabled: (disabled) => {
    // Toggling to true (disabled) → clear locations + locationsMaxDistance
    // so DB has no stale data (per user spec 2026-09-06).
    if (disabled === true) {
      set({
        locationsDisabled: true,
        locations: [],
        locationsMaxDistance: null,
      });
      return;
    }
    set({ locationsDisabled: false });
  },
  setLocationsMaxDistance: (radius) => {
    // null is always valid: means "use pass-type default".
    if (radius === null) { set({ locationsMaxDistance: null }); return; }
    // Clamp integer to [100, 1000].
    const clamped = Math.round(Number(radius));
    if (!Number.isFinite(clamped)) { set({ locationsMaxDistance: null }); return; }
    set({
      locationsMaxDistance: Math.max(
        LOCATIONS_MAX_DISTANCE_MIN,
        Math.min(LOCATIONS_MAX_DISTANCE_MAX, clamped),
      ),
    });
  },
  setLocationName: (idx, name) =>
    set((state) => ({
      locations: state.locations.map((row, i) =>
        i === idx ? { ...row, name: name.slice(0, LOCATION_NAME_MAX_LENGTH) } : row,
      ),
    })),
  setLocationLatitude: (idx, latitude) =>
    set((state) => ({
      locations: state.locations.map((row, i) =>
        i === idx ? { ...row, latitude } : row,
      ),
    })),
  setLocationLongitude: (idx, longitude) =>
    set((state) => ({
      locations: state.locations.map((row, i) =>
        i === idx ? { ...row, longitude } : row,
      ),
    })),
  setLocationRelevantText: (idx, relevantText) =>
    set((state) => ({
      locations: state.locations.map((row, i) => {
        if (i !== idx) return row;
        if (relevantText === null) return { ...row, relevantText: null };
        return {
          ...row,
          relevantText: relevantText.slice(0, RELEVANT_TEXT_MAX_LENGTH),
        };
      }),
    })),
  addLocation: () =>
    set((state) => {
      if (state.locations.length >= LOCATIONS_MAX) return {};
      // Push a fully-typed empty row. lat/lng default to NaN so the
      // `validateLocation` later flags them as invalid; UI shows the
      // red border on the relevant field once `showValidation` flips.
      // 2026-09-06 refactor: row shape now includes `relevantText`.
      const row: LocationInput = {
        name: '',
        latitude: Number.NaN,
        longitude: Number.NaN,
        relevantText: null,
      };
      return { locations: [...state.locations, row] };
    }),
  removeLocation: (idx) =>
    set((state) => ({
      // No auto-refill — locations are optional when locationsDisabled=true.
      // When locationsDisabled=false, workspace isStep5Valid() enforces
      // ≥ 1 row instead (the user sees a red "add at least 1" message).
      locations: state.locations.filter((_, i) => i !== idx),
    })),

  // ===== Step 6 — 集點卡邏輯 setters (2026-09-07) =====
  setStampAccrualMode: (mode) => set({ stampAccrualMode: mode }),
  setRewardName: (name) =>
    set({ rewardName: name.slice(0, REWARD_NAME_MAX_LENGTH) }),
  /** setRewardType clears rewardValue + maxDiscountAmount when type changes (old values are invalid for new type's range). */
  setRewardType: (type) =>
    set({ rewardType: type, rewardValue: null, maxDiscountAmount: null }),
  /** Reject ≤ 0; backend zod `.positive()` is the authoritative gate on save. */
  setRewardValue: (value) => {
    if (value !== null && (typeof value !== 'number' || value <= 0 || !Number.isFinite(value))) {
      return;
    }
    set({ rewardValue: value });
  },
  /** null = 無上限. Clamps to [0, MAX_DISCOUNT_AMOUNT_MAX]. */
  setMaxDiscountAmount: (amount) => {
    if (amount === null) { set({ maxDiscountAmount: null }); return; }
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
    const clamped = Math.max(0, Math.min(amount, MAX_DISCOUNT_AMOUNT_MAX));
    set({ maxDiscountAmount: clamped });
  },
  /** Reject ≤ 0. null = 未填. */
  setStampsPerVisitCount: (count) => {
    if (count === null) { set({ stampsPerVisitCount: null }); return; }
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return;
    set({ stampsPerVisitCount: Math.round(count) });
  },
  /** Reject ≤ 0. null = 未填. */
  setStampsPerVisitStamps: (stamps) => {
    if (stamps === null) { set({ stampsPerVisitStamps: null }); return; }
    if (typeof stamps !== 'number' || !Number.isFinite(stamps) || stamps <= 0) return;
    set({ stampsPerVisitStamps: Math.round(stamps) });
  },
  /** Reject ≤ 0. null = 未填. */
  setStampsPerSpendAmount: (amount) => {
    if (amount === null) { set({ stampsPerSpendAmount: null }); return; }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
    set({ stampsPerSpendAmount: amount });
  },
  /** Reject ≤ 0. null = 未填. */
  setStampsPerSpendStamps: (stamps) => {
    if (stamps === null) { set({ stampsPerSpendStamps: null }); return; }
    if (typeof stamps !== 'number' || !Number.isFinite(stamps) || stamps <= 0) return;
    set({ stampsPerSpendStamps: Math.round(stamps) });
  },

  // ===== Step 6 — REWARD 卡邏輯 setters (2026-09-09 mixed refactor) =====
  // 2026-09-09: top-level `setEarningMode` is re-introduced (was removed in
  // an earlier per-tier refactor). `setEarningMode` ALSO clears all
  // per-tier earn fields (pointsPerVisit / pointsPerSpendAmount /
  // pointsPerSpendPoints) across ALL tiers when mode changes — different
  // modes have different meaningful fields, so we wipe to avoid stale data.

  /**
   * 設定整張卡片的點數累積方式.
   * 切換時清空所有 per-tier earn fields (pointsPerVisit /
   * pointsPerSpendAmount / pointsPerSpendPoints) 以避免 stale data.
   *
   * No-op if mode is unchanged. null is allowed (= 未選).
   */
  setEarningMode: (mode) =>
    set((state) => {
      if (mode === state.earningMode) return {};
      return {
        earningMode: mode,
        rewardTiers: state.rewardTiers.map((tier) => ({
          ...tier,
          pointsPerVisit: null,
          pointsPerSpendAmount: null,
          pointsPerSpendPoints: null,
        })),
      };
    }),

  /**
   * 新增一組空白 rewardTier. 在 MAX_REWARD_TIERS=5 時為 no-op（與後端 schema cap 對齊）.
   * 新增的 tier id 用 crypto.randomUUID() 確保 React key 唯一.
   *
   * 2026-09-09 mixed refactor: 新 tier 不再 init earningMode（已移至 top-level）。
   * Per-tier earn rate fields (pointsPerVisit / pointsPerSpendAmount /
   * pointsPerSpendPoints) 仍 init 為 null — 使用者會在卡片級 earningMode 確定後
   * 透過對應的 field 填入。
   * rewardType / rewardValue 用 `null as unknown as T` placeholder
   * 因為使用者尚未選；store 內部用來跟 zod 的 `.positive()` 合約對齊.
   */
  addRewardTier: () =>
    set((state) => {
      if (state.rewardTiers.length >= MAX_REWARD_TIERS) return {};
      const newTier: RewardTierShape & { id: string } = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        threshold: 0,
        rewardType: null as unknown as RewardType, // 使用者尚未選
        rewardValue: null as unknown as number,    // 使用者尚未填
        maxDiscountAmount: null,
        // Per-tier earn rate fields (2026-09-09 — earningMode moved to top-level)
        pointsPerVisit: null,
        pointsPerSpendAmount: null,
        pointsPerSpendPoints: null,
      };
      return { rewardTiers: [...state.rewardTiers, newTier] };
    }),
  /** 移除指定 id 的 rewardTier. 不會自動 refill. */
  removeRewardTier: (id) =>
    set((state) => ({
      rewardTiers: state.rewardTiers.filter((tier) => tier.id !== id),
    })),
  /**
   * 更新指定 id 的 rewardTier（partial patch）.
   * 對 rewardType / rewardValue / maxDiscountAmount 套用相同於 STAMP 的守門規則.
   *
   * 2026-09-09 mixed refactor: earningMode 不再 per-tier — 從此 setter 移除
   * earningMode guard。Per-tier earn rate fields (pointsPerVisit /
   * pointsPerSpendAmount / pointsPerSpendPoints) 仍 per-tier：
   *   - pointsPerVisit 必須 ≥ POINTS_PER_VISIT_MIN。
   *   - pointsPerSpendAmount 必須 ≥ POINTS_PER_SPEND_MIN_AMOUNT。
   *   - pointsPerSpendPoints 必須 ≥ POINTS_PER_SPEND_MIN_POINTS（整數）。
   *
   * 切換 card-wide earningMode 透過 `setEarningMode`（會清空所有 tier 的
   * earn rate fields），不會透過 `updateRewardTier`。
   */
  updateRewardTier: (id, patch) =>
    set((state) => ({
      rewardTiers: state.rewardTiers.map((tier) => {
        if (tier.id !== id) return tier;
        const next = { ...tier, ...patch };
        // 守門: rewardType 只能是 'amount_off' | 'percent_off'
        if (patch.rewardType !== undefined) {
          if (patch.rewardType !== 'amount_off' && patch.rewardType !== 'percent_off') {
            return tier; // ignore invalid type
          }
          // 切換 rewardType 時清空 rewardValue + maxDiscountAmount
          next.rewardValue = null as unknown as number;
          next.maxDiscountAmount = null;
        }
        // 守門: rewardValue 必須 > 0
        if (patch.rewardValue !== undefined) {
          if (patch.rewardValue === null) {
            next.rewardValue = null as unknown as number;
          } else if (typeof patch.rewardValue === 'number' && Number.isFinite(patch.rewardValue) && patch.rewardValue > 0) {
            next.rewardValue = patch.rewardValue;
          } else {
            // invalid: drop the patch
            next.rewardValue = tier.rewardValue;
          }
        }
        // 守門: maxDiscountAmount 必須 ≥ 0 或 null
        if (patch.maxDiscountAmount !== undefined) {
          if (patch.maxDiscountAmount === null) {
            next.maxDiscountAmount = null;
          } else if (typeof patch.maxDiscountAmount === 'number' && Number.isFinite(patch.maxDiscountAmount) && patch.maxDiscountAmount >= MAX_DISCOUNT_AMOUNT_MIN) {
            next.maxDiscountAmount = Math.min(patch.maxDiscountAmount, MAX_DISCOUNT_AMOUNT_MAX);
          } else {
            next.maxDiscountAmount = tier.maxDiscountAmount;
          }
        }
        // 守門: threshold 必須 ≥ THRESHOLD_MIN (1)
        if (patch.threshold !== undefined) {
          if (typeof patch.threshold === 'number' && Number.isFinite(patch.threshold) && patch.threshold >= THRESHOLD_MIN) {
            next.threshold = Math.min(Math.round(patch.threshold), THRESHOLD_MAX);
          } else {
            next.threshold = tier.threshold;
          }
        }
        // 守門: name 長度上限 REWARD_TIER_NAME_MAX_LENGTH
        if (patch.name !== undefined) {
          next.name = String(patch.name).slice(0, REWARD_TIER_NAME_MAX_LENGTH);
        }
        // ===== Per-tier earn rate guards (2026-09-09 mixed refactor) =====
        // earningMode 不再 per-tier — 由 setEarningMode 處理卡片級切換並清空
        // per-tier earn fields。這裡只守住 per-tier 的 rate fields。
        // 守門: pointsPerVisit 必須 ≥ POINTS_PER_VISIT_MIN 或 null
        if (patch.pointsPerVisit !== undefined) {
          if (patch.pointsPerVisit === null) {
            next.pointsPerVisit = null;
          } else if (
            typeof patch.pointsPerVisit === 'number' &&
            Number.isFinite(patch.pointsPerVisit) &&
            patch.pointsPerVisit >= POINTS_PER_VISIT_MIN
          ) {
            next.pointsPerVisit = Math.round(patch.pointsPerVisit);
          } else {
            next.pointsPerVisit = tier.pointsPerVisit;
          }
        }
        // 守門: pointsPerSpendAmount 必須 ≥ POINTS_PER_SPEND_MIN_AMOUNT 或 null
        if (patch.pointsPerSpendAmount !== undefined) {
          if (patch.pointsPerSpendAmount === null) {
            next.pointsPerSpendAmount = null;
          } else if (
            typeof patch.pointsPerSpendAmount === 'number' &&
            Number.isFinite(patch.pointsPerSpendAmount) &&
            patch.pointsPerSpendAmount >= POINTS_PER_SPEND_MIN_AMOUNT
          ) {
            next.pointsPerSpendAmount = patch.pointsPerSpendAmount;
          } else {
            next.pointsPerSpendAmount = tier.pointsPerSpendAmount;
          }
        }
        // 守門: pointsPerSpendPoints 必須 ≥ POINTS_PER_SPEND_MIN_POINTS 或 null
        if (patch.pointsPerSpendPoints !== undefined) {
          if (patch.pointsPerSpendPoints === null) {
            next.pointsPerSpendPoints = null;
          } else if (
            typeof patch.pointsPerSpendPoints === 'number' &&
            Number.isFinite(patch.pointsPerSpendPoints) &&
            patch.pointsPerSpendPoints >= POINTS_PER_SPEND_MIN_POINTS
          ) {
            next.pointsPerSpendPoints = Math.round(patch.pointsPerSpendPoints);
          } else {
            next.pointsPerSpendPoints = tier.pointsPerSpendPoints;
          }
        }
        return next;
      }),
    })),
  /** 依 threshold 由小到大排序（存檔前自動呼叫). */
  sortRewardTiers: () =>
    set((state) => ({
      rewardTiers: [...state.rewardTiers].sort((a, b) => a.threshold - b.threshold),
    })),

  // ===== Step 6 — Cashback 卡邏輯 setters (2026-09-11) =====
  /**
   * 新增一組空白 cashbackTier. 在 MAX_CASHBACK_TIERS=5 時為 no-op.
   * 用 crypto.randomUUID() 當 id.
   */
  addCashbackTier: () =>
    set((state) => {
      if (state.cashbackTiers.length >= MAX_CASHBACK_TIERS) return {};
      const newTier: CashbackTierShape & { id: string } = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `cashback-tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        thresholdSpend: 0,
        cashbackPercent: 1,
      };
      return { cashbackTiers: [...state.cashbackTiers, newTier] };
    }),
  /** 移除指定 id 的 cashbackTier. 不會自動 refill. */
  removeCashbackTier: (id) =>
    set((state) => ({
      cashbackTiers: state.cashbackTiers.filter((tier) => tier.id !== id),
    })),
  /**
   * 更新指定 id 的 cashbackTier（partial patch）.
   * Guards:
   *   - name: slice to CASHBACK_TIER_NAME_MAX_LENGTH
   *   - thresholdSpend: reject < 0 (allow 0 = legitimate default)
   *   - cashbackPercent: reject < 1 or > 100, integer
   */
  updateCashbackTier: (id, patch) =>
    set((state) => ({
      cashbackTiers: state.cashbackTiers.map((tier) => {
        if (tier.id !== id) return tier;
        const next = { ...tier, ...patch };
        // Guard: name length
        if (patch.name !== undefined) {
          next.name = String(patch.name).slice(0, CASHBACK_TIER_NAME_MAX_LENGTH);
        }
        // Guard: thresholdSpend >= 0 (allow 0 as legitimate default)
        if (patch.thresholdSpend !== undefined) {
          if (
            typeof patch.thresholdSpend === 'number' &&
            Number.isFinite(patch.thresholdSpend) &&
            patch.thresholdSpend >= CASHBACK_THRESHOLD_MIN
          ) {
            next.thresholdSpend = Math.min(
              Math.round(patch.thresholdSpend),
              CASHBACK_THRESHOLD_MAX,
            );
          } else {
            next.thresholdSpend = tier.thresholdSpend;
          }
        }
        // Guard: cashbackPercent ∈ [1, 100] integer
        if (patch.cashbackPercent !== undefined) {
          if (
            patch.cashbackPercent === null ||
            (typeof patch.cashbackPercent === 'number' &&
              Number.isFinite(patch.cashbackPercent) &&
              patch.cashbackPercent >= CASHBACK_PERCENT_MIN &&
              patch.cashbackPercent <= CASHBACK_PERCENT_MAX)
          ) {
            next.cashbackPercent =
              patch.cashbackPercent === null
                ? 1
                : Math.round(patch.cashbackPercent);
          } else {
            next.cashbackPercent = tier.cashbackPercent;
          }
        }
        return next;
      }),
    })),
  /** 依 thresholdSpend 由小到大排序（存檔前自動呼叫，threshold=0 在最前). */
  sortCashbackTiers: () =>
    set((state) => ({
      cashbackTiers: [...state.cashbackTiers].sort(
        (a, b) => a.thresholdSpend - b.thresholdSpend,
      ),
    })),

  loadSettings: (settings) => {
    // Bug #8.5 defensive: settings may be object / JSON string / array-of-partials
    // (legacy corruption). unwrapCardSettings handles all cases.
    const resolved = unwrapCardSettings(settings);

    console.log('[CardBuilderEditor] loadSettings resolved:', JSON.stringify(resolved));
    set((state) => {
      // Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): when a user
      // resumes a draft, the version for issuerLogo/iconImage was reset
      // to 0 by `reset()` in CardBuilderEditor's mount effect. If the
      // browser had previously cached a 404 / partial / stale response
      // for the same R2 key, the cached version would be served on reload
      // — leaving the icon image broken forever (until the user re-uploads).
      //
      // Bumping to Date.now() on loadSettings guarantees the URL has a
      // fresh cache-busting query param the moment we know a key exists,
      // forcing the browser to refetch from R2 (which now has the real
      // object, verified by Phase 2 wrangler evidence).
      const loadLogo = resolved?.issuerLogo as string | undefined;
      const loadIcon = resolved?.iconImage as string | undefined;
      const loadBg = resolved?.backgroundImage as string | undefined;
      const issuerLogo = loadLogo ?? state.issuerLogo;
      const iconImage = loadIcon ?? state.iconImage;
      const backgroundImage = loadBg ?? state.backgroundImage;
      return {
        name: (resolved?.name ?? state.name) as string,
        cardType: (resolved?.cardType ?? state.cardType) as CardType | null,
        issuerName: (resolved?.issuerName ?? state.issuerName) as string,
        issuerLogo,
        iconImage,
        // Bump version only if the key actually changed (or we just loaded one).
        issuerLogoVersion: loadLogo && loadLogo !== state.issuerLogo
          ? Date.now()
          : state.issuerLogoVersion,
        iconImageVersion: loadIcon && loadIcon !== state.iconImage
          ? Date.now()
          : state.iconImageVersion,
        backgroundImage,
        backgroundImageVersion: loadBg && loadBg !== state.backgroundImage
          ? Date.now()
          : state.backgroundImageVersion,
        backgroundColor: normalizeLoadedColor(resolved?.backgroundColor, state.backgroundColor),
        textColor: normalizeLoadedColor(resolved?.textColor, state.textColor),
        holderName: (resolved?.holderName ?? state.holderName) as string,
        barcodeType: (resolved?.barcodeType ?? state.barcodeType) as BarcodeType,
        storeName: (resolved?.storeName ?? state.storeName) as string,
        passValidDays: resolved?.passValidDays !== undefined ? resolved.passValidDays as number | null : state.passValidDays,
        expiryDate: (resolved?.expiryDate ?? state.expiryDate) as string,
        currency: (resolved?.currency ?? state.currency) as 'TWD' | 'ZAR',
        leftField: (resolved?.leftField ?? state.leftField) as CardFieldKey | null,
        rightField: (resolved?.rightField ?? state.rightField) as CardFieldKey | null,
        isPaid: (resolved?.isPaid ?? state.isPaid) as boolean,
        stampGridRows: (resolved?.stampGridRows ?? state.stampGridRows) as 1 | 2 | 3 | 4,
        stampIconId: (resolved?.stampIconId ?? state.stampIconId) as string,
        // ===== Step 4 (2026-09-04) =====
        // Description: string or undefined. Use ?? '' so loading an absent
        // description leaves a stale string behind only when one was already
        // typed — matches the semantics of other fields.
        description: (resolved?.description ?? state.description) as string,
        // backFields: array of {label, value}. Sanitize to plain pairs; if
        // the DB row had a malformed shape (e.g. legacy corruption) we fall
        // back to one empty row to keep the UI usable.
        backFields: sanitizeLabelValueArray(
          resolved?.backFields,
          state.backFields,
          BACK_FIELDS_MAX,
          /* fallbackWhenInvalid */ [{ label: '', value: '' }],
        ),
        links: sanitizeLabelValueArray(
          resolved?.links,
          state.links,
          LINKS_MAX,
          /* fallbackWhenInvalid */ [],
        ),
        // ===== Step 5 (2026-09-05, refactored 2026-09-06) =====
        initialMessage: sanitizeInitialMessage(resolved?.initialMessage, state.initialMessage),
        // locationsDisabled toggle: boolean. Defensive — coerce non-boolean
        // (string/number from corrupted DB) to the default `false`.
        locationsDisabled: (() => {
          const v = resolved?.locationsDisabled;
          if (typeof v === 'boolean') return v;
          return state.locationsDisabled;
        })(),
        // Locations max distance: null or integer in [100, 1000].
        // Anything else (string, NaN, out-of-range) is coerced to null
        // (use pass-type default). Backward-compat fallback: if
        // `locationsMaxDistance` is missing but legacy `notificationRadius`
        // is present (pre-Migration 017 rows), use that.
        locationsMaxDistance: (() => {
          const direct = resolved?.locationsMaxDistance;
          const legacy = resolved?.notificationRadius;
          const raw = direct !== undefined ? direct : legacy;
          if (raw === null) return null;
          if (typeof raw !== 'number') return state.locationsMaxDistance;
          const n = Math.round(raw);
          if (!Number.isFinite(n)) return state.locationsMaxDistance;
          return Math.max(
            LOCATIONS_MAX_DISTANCE_MIN,
            Math.min(LOCATIONS_MAX_DISTANCE_MAX, n),
          );
        })(),
        locations: sanitizeLocations(resolved?.locations, state.locations),
        // ===== Step 6 — 集點卡邏輯 (2026-09-07) =====
        stampAccrualMode: (() => {
          const raw = resolved?.stampAccrualMode;
          if (raw === null) return null;
          if (typeof raw === 'string' && ACCRUAL_MODES.includes(raw as AccrualMode)) {
            return raw as AccrualMode;
          }
          return state.stampAccrualMode;
        })(),
        rewardName: (() => {
          const raw = resolved?.rewardName;
          if (typeof raw === 'string') return raw.slice(0, REWARD_NAME_MAX_LENGTH);
          return state.rewardName;
        })(),
        rewardType: (() => {
          const raw = resolved?.rewardType;
          if (raw === null) return null;
          if (raw === 'amount_off' || raw === 'percent_off') return raw;
          return state.rewardType;
        })(),
        rewardValue: (() => {
          const raw = resolved?.rewardValue;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
          return state.rewardValue;
        })(),
        maxDiscountAmount: (() => {
          const raw = resolved?.maxDiscountAmount;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
            return Math.min(raw, MAX_DISCOUNT_AMOUNT_MAX);
          }
          return state.maxDiscountAmount;
        })(),
        stampsPerVisitCount: (() => {
          const raw = resolved?.stampsPerVisitCount;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.round(raw);
          return state.stampsPerVisitCount;
        })(),
        stampsPerVisitStamps: (() => {
          const raw = resolved?.stampsPerVisitStamps;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.round(raw);
          return state.stampsPerVisitStamps;
        })(),
        stampsPerSpendAmount: (() => {
          const raw = resolved?.stampsPerSpendAmount;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
          return state.stampsPerSpendAmount;
        })(),
        stampsPerSpendStamps: (() => {
          const raw = resolved?.stampsPerSpendStamps;
          if (raw === null) return null;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.round(raw);
          return state.stampsPerSpendStamps;
        })(),
        // ===== Step 6 — REWARD 卡邏輯 (2026-09-09 mixed refactor) =====
        // earningMode is now CARD-WIDE (top-level), read directly from the
        // resolved settings. Old per-tier drafts (the brief per-tier
        // refactor earlier in the day) are tolerated by hoisting their
        // tier[0].earningMode into top-level state if no top-level key
        // exists. The next save normalizes the shape (top-level only).
        earningMode: (() => {
          // 1) Prefer top-level earningMode (current contract).
          const rawTop = resolved?.earningMode;
          if (
            rawTop === 'based_on_points' ||
            rawTop === 'based_on_visits' ||
            rawTop === 'based_on_spending'
          ) {
            return rawTop as EarningMode;
          }
          if (rawTop === null) return null;
          // 2) Backward-compat: if top-level is absent but tier[0] had a
          // per-tier earningMode (the earlier refactor's shape), hoist it.
          const rawTiers = resolved?.rewardTiers;
          if (Array.isArray(rawTiers) && rawTiers.length > 0) {
            const t0 = rawTiers[0] as Record<string, unknown> | undefined;
            const legacyMode = t0?.earningMode;
            if (
              legacyMode === 'based_on_points' ||
              legacyMode === 'based_on_visits' ||
              legacyMode === 'based_on_spending'
            ) {
              return legacyMode as EarningMode;
            }
          }
          // 3) Fallback to current store value.
          return state.earningMode;
        })(),
        // ===== Step 6 — REWARD 卡邏輯 (2026-09-09 mixed refactor) =====
        // 2026-09-09: earningMode moved back to top-level. Each rewardTier
        // now carries ONLY per-tier earn rate fields (pointsPerVisit /
        // pointsPerSpendAmount / pointsPerSpendPoints); earningMode itself
        // is no longer per-tier.
        //
        // Backward-compat for legacy per-tier drafts (the earlier refactor's
        // shape):
        //   - If tier[0] had a per-tier earningMode but no top-level key
        //     existed, the hoisted top-level field above gets set on load.
        //   - Per-tier pointsPerVisit / pointsPerSpend* fields stay per-tier.
        //   - On save, top-level earningMode is sent; per-tier earningMode
        //     (if any pre-refactor row has it) is dropped from the payload
        //     because the backend schema no longer carries that field.
        rewardTiers: (() => {
          // Defensive: rewardTiers is an array of tier entries.
          // Each tier carries reward rule (name + threshold + rewardType +
          // rewardValue + maxDiscountAmount) + per-tier earn rate fields
          // (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints).
          const raw = resolved?.rewardTiers;
          if (!Array.isArray(raw)) return state.rewardTiers;
          // Backward-compat: hoist top-level earn rate keys into tier[0].
          // Only do this when the array is non-empty AND no tier already
          // carries that rate field (so we don't clobber tier-local data).
          const hasLegacyTopLevelPoints =
            resolved?.pointsPerVisit !== undefined ||
            resolved?.pointsPerSpendAmount !== undefined ||
            resolved?.pointsPerSpendPoints !== undefined;
          const trimmed: Array<RewardTierShape & { id: string }> = [];
          for (const entry of raw.slice(0, MAX_REWARD_TIERS)) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const obj = entry as Record<string, unknown>;
            const name =
              typeof obj.name === 'string'
                ? obj.name.slice(0, REWARD_TIER_NAME_MAX_LENGTH)
                : '';
            const threshold =
              typeof obj.threshold === 'number' && Number.isFinite(obj.threshold) && obj.threshold >= THRESHOLD_MIN
                ? Math.min(Math.round(obj.threshold), THRESHOLD_MAX)
                : 0;
            const rewardType =
              obj.rewardType === 'amount_off' || obj.rewardType === 'percent_off'
                ? (obj.rewardType as RewardType)
                : (null as unknown as RewardType);
            const rewardValue =
              typeof obj.rewardValue === 'number' && Number.isFinite(obj.rewardValue) && obj.rewardValue > 0
                ? obj.rewardValue
                : (null as unknown as number);
            const maxDiscountAmount =
              obj.maxDiscountAmount === null
                ? null
                : typeof obj.maxDiscountAmount === 'number' && Number.isFinite(obj.maxDiscountAmount) && obj.maxDiscountAmount >= 0
                ? Math.min(obj.maxDiscountAmount, MAX_DISCOUNT_AMOUNT_MAX)
                : null;
            // Per-tier earn rate fields (2026-09-09 mixed refactor:
            // earningMode itself is top-level now, only rate stays per-tier).
            const pointsPerVisit =
              typeof obj.pointsPerVisit === 'number' && Number.isFinite(obj.pointsPerVisit) && obj.pointsPerVisit >= 1
                ? Math.round(obj.pointsPerVisit)
                : null;
            const pointsPerSpendAmount =
              typeof obj.pointsPerSpendAmount === 'number' && Number.isFinite(obj.pointsPerSpendAmount) && obj.pointsPerSpendAmount > 0
                ? obj.pointsPerSpendAmount
                : null;
            const pointsPerSpendPoints =
              typeof obj.pointsPerSpendPoints === 'number' && Number.isFinite(obj.pointsPerSpendPoints) && obj.pointsPerSpendPoints >= 1
                ? Math.round(obj.pointsPerSpendPoints)
                : null;
            // id: reload preserves id if present (matches existing tier); otherwise generate new.
            // Since this is a defensive parse from DB, ids likely won't match — we generate a new one.
            // The stable id across loads isn't required (the tier data is the source of truth).
            const id =
              typeof obj.id === 'string'
                ? obj.id
                : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            trimmed.push({
              id,
              name,
              threshold,
              rewardType,
              rewardValue,
              maxDiscountAmount,
              pointsPerVisit,
              pointsPerSpendAmount,
              pointsPerSpendPoints,
            });
          }
          // Backward-compat hoist: pre-mixed-refactor drafts may have
          // top-level earn rate keys without per-tier rate fields. Promote
          // them into tier[0] so the user doesn't lose data on reload.
          if (hasLegacyTopLevelPoints && trimmed.length > 0 && trimmed[0]) {
            const t0 = trimmed[0];
            if (t0.pointsPerVisit === null && typeof resolved?.pointsPerVisit === 'number') {
              t0.pointsPerVisit = resolved.pointsPerVisit;
            }
            if (t0.pointsPerSpendAmount === null && typeof resolved?.pointsPerSpendAmount === 'number') {
              t0.pointsPerSpendAmount = resolved.pointsPerSpendAmount;
            }
            if (t0.pointsPerSpendPoints === null && typeof resolved?.pointsPerSpendPoints === 'number') {
              t0.pointsPerSpendPoints = resolved.pointsPerSpendPoints;
            }
          }
          // Sort by threshold ascending for stable display order after load.
          return trimmed.sort((a, b) => a.threshold - b.threshold);
        })(),
        // ===== Step 6 — Cashback 卡 loadSettings (2026-09-11) =====
        // Defensive parse of `resolved.cashbackTiers` array.
        // Each tier: { name, thresholdSpend (>=0), cashbackPercent (1-100) }.
        // Sorts by thresholdSpend ASC (threshold=0 first = default tier).
        cashbackTiers: (() => {
          const raw = resolved?.cashbackTiers;
          if (!Array.isArray(raw)) return state.cashbackTiers;
          const trimmed: Array<CashbackTierShape & { id: string }> = [];
          for (const entry of raw.slice(0, MAX_CASHBACK_TIERS)) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const obj = entry as Record<string, unknown>;
            const name =
              typeof obj.name === 'string'
                ? obj.name.slice(0, CASHBACK_TIER_NAME_MAX_LENGTH)
                : '';
            const thresholdSpend =
              typeof obj.thresholdSpend === 'number' &&
              Number.isFinite(obj.thresholdSpend) &&
              obj.thresholdSpend >= CASHBACK_THRESHOLD_MIN
                ? Math.min(Math.round(obj.thresholdSpend), CASHBACK_THRESHOLD_MAX)
                : 0;
            const cashbackPercent =
              typeof obj.cashbackPercent === 'number' &&
              Number.isFinite(obj.cashbackPercent) &&
              obj.cashbackPercent >= CASHBACK_PERCENT_MIN &&
              obj.cashbackPercent <= CASHBACK_PERCENT_MAX
                ? Math.round(obj.cashbackPercent)
                : 1;
            const id =
              typeof obj.id === 'string'
                ? obj.id
                : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `cashback-tier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            trimmed.push({ id, name, thresholdSpend, cashbackPercent });
          }
          // Sort by thresholdSpend ASC (threshold=0 first = default tier).
          return trimmed.sort((a, b) => a.thresholdSpend - b.thresholdSpend);
        })(),
      };
    });
  },

  reset: () => set({ ...typedInitialState, isPaid: typedInitialState.isPaid, issuerLogoVersion: 0, iconImageVersion: 0, backgroundImageVersion: 0 }),
}));
