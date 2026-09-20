/**
 * Multipass Card (多通卡) constants — Step 6 (2026-09-19, PR-5 extension 2026-09-20).
 *
 * @module shared/constants/multipass-card
 * @description Pure constants and bounds for the Multipass Card Logic editor.
 *
 * Differs from stamp_card (集點卡):
 *   - Stamp card has a SINGLE flat reward (single rewardName + rewardType
 *     + rewardValue + maxDiscountAmount).
 *   - Multipass card has UP TO 5 tiers, each tier carries its own
 *     name + stampsNeeded + rewardType + rewardValue.
 *   - Multipass card supports "歡迎禮" semantics: a tier with
 *     stampsNeeded = 0 is legitimate (the user gets the reward
 *     immediately upon downloading the card).
 *
 * stampsNeeded is COMPLETELY DECOUPLED from the Step 3 stamp grid
 * (stampGridRows × 5). Multipass cards can stack stamps across multiple
 * physical visits (the customer accumulates stamps from N different
 * physical cards onto one virtual multipass). Backend zod schema does
 * NOT cap stampsNeeded beyond a 999 safety valve (matches design
 * decision 2026-09-19).
 *
 * 2026-09-20 PR-5: 新增 multipassAccrualMode (card-wide 三選一蓋章方式)
 * + per-tier 門檻欄位 (perVisitCount / perVisitStamps / perSpendAmount /
 * perSpendStamps). 差別於 stamp_card: 門檻輸入框放在每個 tier row 內
 * (使用者確認: 「在大規則下每個 tier 有細微可控制的邏輯」).
 *
 * Single source of truth (Rule 019 § 4.1). Both frontend UI store +
 * components and backend schema import from here so the field shape
 * and limits stay in sync.
 */

/** Hard cap: max number of multipass tiers per card. */
export const MAX_MULTIPASS_TIERS = 5;

/** Multipass tier name (e.g. "新戶禮", "VIP 回饋"). 40 chars matches PassCreator title cap. */
export const MULTIPASS_TIER_NAME_MAX_LENGTH = 40;

/**
 * Stamps required to unlock this tier reward.
 *
 * - 0 = 歡迎禮「辦卡立刻送」(legitimate, supported value)
 * - 1..999 = user design choice (no enforcement of monotonic order)
 *
 * NOT coupled with Step 3 stampGridRows × 5 — multipass cards may
 * stack stamps across multiple physical cards (N visit-passes
 * accumulate onto the multipass). Backend zod caps at 999 purely as a
 * safety valve against typos (e.g. user types 99999).
 */
export const MULTIPASS_STAMPS_NEEDED_MIN = 0;
export const MULTIPASS_STAMPS_NEEDED_MAX = 999;

/** Reward type discriminator (mirrors stamp_card rewardType). */
export const MULTIPASS_REWARD_TYPES = ['amount_off', 'percent_off'] as const;
export type MultipassRewardType = (typeof MULTIPASS_REWARD_TYPES)[number];

/**
 * 蓋章方式 (2026-09-20 PR-5): 卡片層級, 決定 stamps 累積觸發方式.
 *
 * 對齊 stamp_card ACCRUAL_MODES:
 *   - per_stamp: 手動蓋章 (店員按鈕 / 系統無自動累積)
 *   - per_visit: 來訪自動 (每 N 次拜訪 → M 個蓋章)
 *   - per_spend: 消費自動 (每消費 N 元 → M 個蓋章)
 *
 * 差別: Multipass 把門檻欄位放 per-tier (使用者確認: 「在大規則下
 * 每個 tier 有細微可控制的邏輯」). Stamp 卡則是 card-wide 共用一組
 * 門檻 (stampsPerVisitCount / stampsPerSpendAmount 在 store 頂層).
 *
 * 4-layer sync (Rule 019 § 4.1):
 *   - packages/shared/constants/multipass-card.ts (本檔 — single source of truth)
 *   - packages/shared/schemas/cardBuilder.ts (cardTypeExtensions.multipass.multipassAccrualMode)
 *   - packages/shared/schemas/card.ts (templateSettingsSchema.multipassAccrualMode)
 *   - apps/backend/src/modules/cards/schemas/request.ts (backend mirror)
 */
export const MULTIPASS_ACCRUAL_MODES = ['per_stamp', 'per_visit', 'per_spend'] as const;
export type MultipassAccrualMode = (typeof MULTIPASS_ACCRUAL_MODES)[number];

/**
 * Per-tier 來訪門檻欄位範圍 (2026-09-20 PR-5, multipassAccrualMode === 'per_visit' 時使用).
 *
 * perVisitCount = N (拜訪次數, integer ≥ 1)
 * perVisitStamps = M (獲得蓋章數, integer ≥ 1)
 *
 * 對齊 stamp_card.STAMPS_PER_VISIT_MIN / STAMPS_PER_STAMPS_MIN.
 */
export const MULTIPASS_STAMPS_PER_VISIT_MIN = 1;
export const MULTIPASS_STAMPS_PER_VISIT_STAMPS_MIN = 1;

/**
 * Per-tier 消費門檻欄位範圍 (2026-09-20 PR-5, multipassAccrualMode === 'per_spend' 時使用).
 *
 * perSpendAmount = N (消費金額, positive number ≥ 0.01)
 * perSpendStamps = M (獲得蓋章數, integer ≥ 1)
 *
 * 對齊 stamp_card.STAMPS_PER_SPEND_MIN / STAMPS_PER_STAMPS_MIN_SPEND.
 */
export const MULTIPASS_STAMPS_PER_SPEND_MIN = 0.01;
export const MULTIPASS_STAMPS_PER_SPEND_STAMPS_MIN = 1;

/**
 * Multipass tier shape.
 *
 * Required field semantics:
 *   - name: tier name shown on the pass. Required (NOT optional).
 *   - stampsNeeded: 0 (welcome gift) or 1..999. Required.
 *   - rewardType: amount_off (cash discount) or percent_off (percentage).
 *   - rewardValue: cash amount (> 0) for amount_off; percent integer
 *     in [1, 100] for percent_off. null when user hasnt picked a type.
 *
 * Per-tier accrual threshold fields (2026-09-20 PR-5):
 *   - perVisitCount / perVisitStamps: 僅在 card-wide multipassAccrualMode
 *     === 'per_visit' 時有意義。Multipass 與 stamp_card 差異: 這些欄位
 *     是 per-tier 的 (使用者確認: 「在大規則下每個 tier 有細微可控制
 *     的邏輯」).
 *   - perSpendAmount / perSpendStamps: 僅在 card-wide multipassAccrualMode
 *     === 'per_spend' 時有意義。同樣 per-tier.
 *
 * UI 顯示規則 (component 層級,見 MultipassTierAccrualThresholdField.tsx):
 *   - multipassAccrualMode === null / 'per_stamp' → 門檻輸入框不渲染
 *   - multipassAccrualMode === 'per_visit' → 顯示 N 次拜訪 = M 個蓋章
 *   - multipassAccrualMode === 'per_spend' → 顯示 消費 N 元(R[N],currency-aware) = M 個蓋章
 *
 * 切換 multipassAccrualMode 不清空門檻欄位 (使用者切換回來時值仍在,
 * UI 條件渲染只是「不顯示」).
 */
export interface MultipassTierShape {
  /** Tier name shown on the pass (e.g. "新戶禮", "VIP 回饋"). 1-40 chars. */
  name: string;
  /**
   * Stamps required to unlock this tier reward.
   * 0 = 歡迎禮「辦卡立刻送」(immediate reward on download).
   * 1..999 = design choice.
   */
  stampsNeeded: number;
  /** Reward type. Mirrors stamp_card rewardType. */
  rewardType: MultipassRewardType | null;
  /** Discount amount (amount_off) or percentage integer 1-100 (percent_off). null when unselected. */
  rewardValue: number | null;
  /**
   * Per-tier 最高折抵金額 (2026-09-20 PR-6, rewardType === 'percent_off' 時有意義).
   * 0 = 無上限; 1..MAX = 折抵上限. undefined = 未填（不等於 null，null = 已填但值為無上限）.
   * 對齊 stamp_card.maxDiscountAmount.
   */
  maxDiscountAmount?: number | null;
  /**
   * Per-tier 來訪門檻 (2026-09-20 PR-5, multipassAccrualMode === 'per_visit' 時使用).
   * N = 拜訪次數, integer ≥ MULTIPASS_STAMPS_PER_VISIT_MIN=1.
   * null = 未填.
   */
  perVisitCount: number | null;
  /**
   * Per-tier 來訪門檻 (2026-09-20 PR-5).
   * M = 獲得蓋章數, integer ≥ MULTIPASS_STAMPS_PER_VISIT_STAMPS_MIN=1.
   * null = 未填.
   */
  perVisitStamps: number | null;
  /**
   * Per-tier 消費門檻 (2026-09-20 PR-5, multipassAccrualMode === 'per_spend' 時使用).
   * N = 消費金額, positive number ≥ MULTIPASS_STAMPS_PER_SPEND_MIN=0.01.
   * null = 未填.
   */
  perSpendAmount: number | null;
  /**
   * Per-tier 消費門檻 (2026-09-20 PR-5).
   * M = 獲得蓋章數, integer ≥ MULTIPASS_STAMPS_PER_SPEND_STAMPS_MIN=1.
   * null = 未填.
   */
  perSpendStamps: number | null;
}