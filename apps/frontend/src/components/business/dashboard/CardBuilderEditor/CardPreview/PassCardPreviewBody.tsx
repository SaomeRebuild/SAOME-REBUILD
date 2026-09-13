/**
 * PassCardPreview — 卡片正面預覽（Body / Secondary Fields 部分）
 * Apple Pass 風格：淡色分隔線 + 標籤/值對（靜態顯示，不含動態 issuerName / storeName）
 *
 * textColor (optional): 套用到 field label + field value 共 4 個 span（左 label、右 value）。
 *
 * PassCreator Label/Value typography (v2 plan 2026-09-04):
 *   - label 是 hint text，font size 較小（10px / 8px compact）
 *   - value 是 primary content，font size 較大（14px / 11px compact, font-medium）
 *   - 兩者都必須存在，符合 PassCreator secondary field 格式。
 *
 * Stamp preview interpolation (2026-09-08, denominator fix 2026-09-08):
 *   - When leftField or rightField is `'totalStamps'`, the value text is
 *     rendered via `t('fieldPreview.totalStamps.value', { rows })`. The
 *     `rows` value reflects the **total stamp count**, not the row count:
 *       total stamps = stampGridRows × STAMPS_PER_ROW (5)
 *     So `rows: 2` produces `'3/10'`, `rows: 4` produces `'3/20'`, and the
 *     fallback (stampGridRows === undefined) produces `'3/5'`. The
 *     `STAMPS_PER_ROW` constant lives in `StampGridPreview.types.ts` and is
 *     shared with `StampGridPreview`'s default `cols` to keep grid geometry
 *     in lock-step.
 *   - When `stampGridRows` is undefined (e.g. user has not yet picked a
 *     grid), we fall back to `1 row × 5 stamps = 5` so the i18n
 *     interpolation never sees `NaN` or `undefined`. The
 *     `Step3StampGrid` section's `StampGridCountSelector` always defaults
 *     to a real value, so this fallback only matters during the brief
 *     window between `loadSettings` and the user's first pick.
 *
 * Stamp card member-level → reward override (2026-09-10):
 *   - When `cardType === 'stamp_card'` AND the picked field is
 *     `'memberLevel'`, the slot renders as a 2-line pair
 *       label = "獎勵" / "Reward" (`fieldPreview.memberLevel.stampLabel`)
 *       value = `rewardName` from the editor store (Step 6 reward name input)
 *     so the live preview shows what the user actually typed in
 *     `step6-reward-name`. When `rewardName` is the empty string (user has
 *     not yet typed anything), the value renders as `''` — no fallback to
 *     the demo "金級" / "Gold" string (per user-confirmed UX: empty input
 *     surfaces as an empty value, not a stale demo placeholder).
 *   - All other cardTypes (incl. `multipass`) keep the original memberLevel
 *     preview (`fieldPreview.memberLevel.label` + `.value`). This is a
 *     pure UI override — the underlying `leftField / rightField` value
 *     stored as `'memberLevel'` is unchanged, and the backend schema is
 *     not modified (per Rule 019 § 4.1).
 *
 * Reward card member-level → reward override (2026-09-10, ext):
 *   - Same label override as stamp_card: when `cardType === 'reward_card'`
 *     AND the picked field is `'memberLevel'`, the slot renders as
 *       label = "獎勵" / "Reward" (`fieldPreview.memberLevel.stampLabel`)
 *       value = `firstRewardTierName` from the editor store (Step 6
 *               `rewardTiers[0].name` input — first row only)
 *     so the live preview reflects the user's first reward tier name.
 *   - When `firstRewardTierName` is the empty string / undefined (user has
 *     not yet added any tier or the first tier's name is blank), the value
 *     renders as `''` — matching the stamp_card empty-string UX.
 *   - Differs from stamp_card ONLY in the value source: stamp reads
 *     `rewardName` (top-level string); reward reads `firstRewardTierName`
 *     (first element of the `rewardTiers[]` array). Same label, same
 *     fallback-to-empty-string contract, same backend schema (the
 *     `leftField / rightField` CardFieldKey is unchanged).
 *   - The override is INTENTIONALLY NOT applied to `multipass` (per
 *     user-confirmed scope: stamp_card + reward_card only).
 *
 * Cashback card member-level → reward override (2026-09-12):
 *   - Same label override as stamp_card / reward_card: when
 *     `cardType === 'cashback_card'` AND the picked field is `'memberLevel'`,
 *     the slot renders as
 *       label = "獎勵" / "Reward" (`fieldPreview.memberLevel.stampLabel`)
 *       value = `firstCashbackTierName` from the editor store (Step 6
 *               `cashbackTiers[0].name` — first row only)
 *     so the live preview reflects the user's first cashback tier name.
 *   - When `firstCashbackTierName` is empty / undefined / no tiers,
 *     the value renders as `''` — matching stamp/reward empty-string UX.
 *   - Differs from stamp/reward ONLY in the data source: reads
 *     `cashbackTiers[0].name` (cashback) vs `rewardName` (stamp) vs
 *     `rewardTiers[0].name` (reward). Same label, same contract.
 *
 * Membership card member-level → first tier name override (2026-09-13, restored):
 *   - When `cardType === 'membership_card'` AND the picked field is
 *     `'memberLevel'`, the slot renders as
 *       label = `fieldPreview.memberLevel.label` (default "會員等級" / "Member Level")
 *               — NOT stampLabel (different from stamp/reward/cashback)
 *       value = `firstMembershipTierName` (Step 6 `membershipTiers[0].name`)
 *     so the live preview reflects the user's first membership tier name
 *     (per user clarification 2026-09-13: "卡片預覽中的左右欄位會員等級的值
 *     沒有被step6 第一個row的等級名稱覆蓋" — membership cards need this
 *     override too).
 *   - When `firstMembershipTierName` is empty / undefined / no tiers, the
 *     value renders as `''` — matching stamp/reward/cashback empty-string UX.
 *   - Differs from stamp/reward/cashback ONLY in the label: uses the default
 *     memberLevel label ("會員等級" / "Member Level") rather than stampLabel
 *     ("獎勵" / "Reward"). Reason: membership cards keep the original
 *     "memberLevel" semantic (it's about tier identity, not reward), so the
 *     label stays the default. Value source differs (membershipTiers[0].name).
 *
 * 2026-09-13 fix (Fix 2): the membership_card override branch has been
 *   RESTORED (previously REMOVED on 2026-09-13, then re-added per user
 *   clarification). The override is now scoped ONLY to membership_card:
 *     - label = `fieldPreview.memberLevel.label` (default "會員等級" / "Member Level")
 *     - value = `firstMembershipTierName` (the FIRST tier name)
 *   The membership tier name still lives in the Back-side Section 4
 *   (會員獎勵 sub-rows from the first tier), but the FRONT-side
 *   left/right memberLevel slot now ALSO reflects the first tier name.
 *
 * Cashback currency-driven amount (2026-09-12, refined 2026-09-13):
 *   When the picked field is one of the cashback-only amount fields
 *   (`pointsToNextTierCashback` or `accumulatedSpendCashback`), the
 *   `value` is sourced from `CASHBACK_PREVIEW_AMOUNTS[currency]` — the
 *   same currency-driven pattern used by `BALANCE_PREVIEW_AMOUNTS` for
 *   the balance preview block in `PassCardPreviewHeader`.
 *   TWD → "562元" / "3301元" (zh-TW) | ZAR → "R562" / "R3301"
 *   Reason for moving values to shared constants (Rule 023 § 翻譯書寫紀律):
 *   en translations may not contain Han characters, so "562元" cannot live
 *   in passCard.en.ts.
 *
 * 2026-09-13 ZAR pollution fix — REMOVED regex-based formatter:
 *   Previously, `resolveSlot` applied a regex-based `R` prefix formatter
 *   (`/\d+/` → prepend "R") to ALL `default` branch i18n values when
 *   `currency === 'ZAR'`. This caused wide-spread contamination of every
 *   non-amount field on every card type:
 *     phone        `+8869XXXXXXXX`     → `R8869XXXXXXXX`
 *     birthday     `05/11/1999`        → `R05111999`
 *     visitCount   `5 次`              → `R5`
 *     totalStamps  `3/{{rows}}`        → `R3` (interpolation broken)
 *     stampsRemain `6個`               → `R6`
 *     pointsToNext `123點`             → `R123`
 *     currentPoints `23點`             → `R23`
 *   Now the regex is GONE. The default branch reads `fieldPreview.{key}.value`
 *   as-is (no ZAR transformation). Only the two cashback amount fields go
 *   through the currency-driven map; everything else is currency-agnostic
 *   demo data.
 *   See plan `zar_preview_field_污染修正_39f87c1e.plan.md` for full root
 *   cause analysis.
 */
import { useTranslation } from 'react-i18next';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { CardType } from '@saome/shared/schemas/card';
import type { Currency } from '@saome/shared/schemas/card';
import { CASHBACK_PREVIEW_AMOUNTS } from '@saome/shared/constants/cashbackPreviewAmounts';
import {
  STAMPS_PER_ROW,
  type StampGridRows,
} from '@/components/business/stampCard/StampGridPreview';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface PassCardPreviewBodyProps {
  /** Optional text color override (hex with #). Applied to label + value spans. */
  textColor?: string;
  compact?: boolean;
  /** 左欄位選取的 field key（null = 顯示 placeholder） */
  leftField?: CardFieldKey | null;
  /** 右欄位選取的 field key（null = 顯示 placeholder） */
  rightField?: CardFieldKey | null;
  /**
   * Stamp grid rows (1..4). Multiplied by `STAMPS_PER_ROW` to interpolate
   * the `totalStamps` preview value (`'3/{{rows}}'` → `'3/10'` when the
   * user picks 2 rows, since 2 rows × 5 stamps/row = 10). Optional — when
   * undefined, the interpolation defaults to `1` row × 5 = 5.
   */
  stampGridRows?: StampGridRows;
  /**
   * Current `cardType` from the editor store. Used to override the
   * `memberLevel` preview slot when cardType is `'stamp_card'`,
   * `'reward_card'`, or `'cashback_card'` (see module docblock). Optional
   * — when omitted, `resolveSlot` falls through to the default
   * label/value path so non-stamp contexts (TemplateCardPreview, etc.)
   * keep working.
   */
  cardType?: CardType | null;
  /**
   * Live reward name from the editor store (Step 6 `step6-reward-name`
   * input). Surfaced as the preview `value` when `cardType === 'stamp_card'`
   * AND the picked field is `'memberLevel'`. Optional — when omitted or
   * empty string, the preview renders an empty value (per user-confirmed UX).
   */
  rewardName?: string;
  /**
   * First reward tier name from the editor store (Step 6 `rewardTiers[0].name`).
   * Surfaced as the preview `value` when `cardType === 'reward_card'` AND the
   * picked field is `'memberLevel'`. Optional — when omitted / empty / when
   * `rewardTiers` is empty, the preview renders an empty value (matches the
   * stamp_card empty-string UX).
   * (2026-09-10 reward card member-level → reward refactor extension.)
   */
  firstRewardTierName?: string;
  /**
   * First cashback tier name from the editor store (Step 6
   * `cashbackTiers[0].name`). Surfaced as the preview `value` when
   * `cardType === 'cashback_card'` AND the picked field is `'memberLevel'`.
   * Optional — when omitted / empty / when `cashbackTiers` is empty, the
   * preview renders an empty value (matches stamp_card / reward_card
   * empty-string UX).
   * (2026-09-12 cashback card member-level → reward refactor.)
   */
  firstCashbackTierName?: string;
  /**
   * First membership tier name from the editor store (Step 6
   * `membershipTiers[0].name`). Surfaced as the preview `value` when
   * `cardType === 'membership_card'` AND the picked field is `'memberLevel'`.
   * Optional — when omitted / empty / when `membershipTiers` is empty, the
   * preview renders an empty value (matches stamp_card / reward_card /
   * cashback_card empty-string UX).
   * (2026-09-13 membership card member-level → first tier name override,
   * restored after Fix 2.)
   *
   * Note: unlike stamp/reward/cashback, the membership override uses
   * `fieldPreview.memberLevel.label` (default "會員等級" / "Member Level")
   * as the label, NOT `stampLabel`. Membership cards keep their tier
   * semantic identity on the front-side label, while the value reflects
   * the user's first tier name.
   */
  firstMembershipTierName?: string;
}

/**
 * Resolve a preview slot's {label, value} pair given the field key + stamp
 * context + cardType.
 *
 * Branch order matters:
 *   1. `!field`                          → placeholder (左欄位 / 右欄位)
 *   2. `stamp_card + memberLevel`        → stamp-card override (label = stampLabel,
 *                                           value = rewardName ?? '')
 *   3. `reward_card + memberLevel`       → reward-card override (label = stampLabel,
 *                                           value = firstRewardTierName ?? '')
 *   4. `cashback_card + memberLevel`     → cashback-card override (label = stampLabel,
 *                                           value = firstCashbackTierName ?? '')
 *   5. `membership_card + memberLevel`   → membership-card override (label = default
 *                                           memberLevel.label, value = firstMembershipTierName ?? '')
 *   6. `totalStamps`                     → rows × STAMPS_PER_ROW interpolation
 *   7. cashback amount fields            → currency-driven
 *                                           (`CASHBACK_PREVIEW_AMOUNTS[currency][field]`)
 *   8. default                           → `fieldPreview.{key}.label` + `.value`
 *                                           (NO ZAR formatter — values are demo
 *                                            data and are NOT currency-dependent)
 *
 * The stamp/reward/cashback/membership-card branches are checked BEFORE the
 * `totalStamps` branch because `memberLevel` is a `common`-group field and
 * could conceptually appear alongside `totalStamps` in the two slots; the
 * member-level override is the more specific case.
 *
 * Cashback amount branch (2026-09-13 ZAR pollution fix):
 *   The two cashback-only display fields (`pointsToNextTierCashback` and
 *   `accumulatedSpendCashback`) read their value from
 *   `CASHBACK_PREVIEW_AMOUNTS[currency]` — a currency-driven map (same
 *   pattern as `BALANCE_PREVIEW_AMOUNTS` for the balance preview block).
 *   This replaces the previous regex-based `R`-prefix formatter (which
 *   contaminated every i18n-sourced value on every card type).
 *
 * Branch order:
 *   1. `!field`                          → placeholder (左欄位 / 右欄位)
 *   2. `stamp_card + memberLevel`        → stamp-card override (label = stampLabel,
 *                                           value = rewardName ?? '')
 *   3. `reward_card + memberLevel`       → reward-card override (label = stampLabel,
 *                                           value = firstRewardTierName ?? '')
 *   4. `cashback_card + memberLevel`     → cashback-card override (label = stampLabel,
 *                                           value = firstCashbackTierName ?? '')
 *   5. `membership_card + memberLevel`   → membership-card override (label = default
 *                                           memberLevel.label, value = firstMembershipTierName ?? '')
 *   6. `totalStamps`                     → rows × STAMPS_PER_ROW interpolation
 *   7. cashback amount fields            → CASHBACK_PREVIEW_AMOUNTS[currency][field]
 *                                           (currency-driven, like balance preview)
 *   8. default                           → `fieldPreview.{key}.label` + `.value`
 *                                           (NO ZAR formatter — values are demo
 *                                            data and are NOT currency-dependent)
 */
function resolveSlot(
  t: (key: string, opts?: Record<string, unknown>) => string,
  field: CardFieldKey | null | undefined,
  stampGridRows: StampGridRows | undefined,
  cardType: CardType | null | undefined,
  rewardName: string | undefined,
  firstRewardTierName: string | undefined,
  firstCashbackTierName: string | undefined,
  firstMembershipTierName: string | undefined,
  currency: Currency,
): { label: string; value: string } {
  if (!field) {
    return { label: t('fieldLabelLeft'), value: t('fieldLabelRight') };
  }

  // Stamp card override: the `memberLevel` slot becomes a "Reward" slot
  // (label = stampLabel) whose value reflects whatever the user typed in
  // the Step 6 reward-name input. Per user-confirmed UX, an empty
  // `rewardName` renders as an empty string rather than to the
  // demo "金級" / "Gold" string — this avoids showing a stale preview
  // before the user has typed anything.
  if (cardType === 'stamp_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: rewardName ?? '',
    };
  }

  // Reward card override: same label as stamp_card ("Reward"), but the
  // value source is the FIRST row of the Step 6 `rewardTiers` array
  // instead of a top-level string. Empty / undefined / no-tiers → empty
  // string (matches stamp_card empty-input UX).
  if (cardType === 'reward_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: firstRewardTierName ?? '',
    };
  }

  // Cashback card override: same label as stamp_card / reward_card ("Reward"),
  // but the value source is the FIRST row of the Step 6 `cashbackTiers` array.
  // Empty / undefined / no-tiers → empty string (matches stamp/reward UX).
  if (cardType === 'cashback_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.stampLabel'),
      value: firstCashbackTierName ?? '',
    };
  }

  // Membership card override (2026-09-13, restored): the `memberLevel`
  // slot keeps its DEFAULT label ("會員等級" / "Member Level") — different
  // from stamp/reward/cashback which use stampLabel ("獎勵" / "Reward").
  // The value source is the FIRST row of the Step 6 `membershipTiers`
  // array. Empty / undefined / no-tiers → empty string (matches the
  // stamp/reward/cashback empty-input UX).
  if (cardType === 'membership_card' && field === 'memberLevel') {
    return {
      label: t('fieldPreview.memberLevel.label'),
      value: firstMembershipTierName ?? '',
    };
  }

  if (field === 'totalStamps') {
    // The user picks a row count (1..4); the displayed denominator is the
    // total stamp count = rows × STAMPS_PER_ROW. We pre-multiply here so
    // the i18n template stays simple (`'3/{{rows}}'`) and the geometry
    // contract is captured in code rather than in the translation string.
    const totalStamps = (stampGridRows ?? 1) * STAMPS_PER_ROW;
    return {
      label: t(`fieldPreview.${field}.label`),
      value: t(`fieldPreview.${field}.value`, { rows: totalStamps }),
    };
  }

  // Cashback amount branch (2026-09-13 ZAR pollution fix): the two
  // cashback-only display fields are currency-driven, NOT i18n-driven.
  // Their values live in `@saome/shared/constants/cashbackPreviewAmounts.ts`
  // — same pattern as `BALANCE_PREVIEW_AMOUNTS` for the balance preview
  // block. This replaces the previous regex-based `R`-prefix formatter
  // that contaminated every i18n-sourced value on every card type.
  if (
    field === 'pointsToNextTierCashback' ||
    field === 'accumulatedSpendCashback'
  ) {
    return {
      label: t(`fieldPreview.${field}.label`),
      value: CASHBACK_PREVIEW_AMOUNTS[currency][field],
    };
  }

  // Default: read label + value from i18n fieldPreview.{key} verbatim.
  // Values are demo data and are NOT currency-dependent (phone numbers,
  // names, dates, counts, etc. have no concept of currency), so we do
  // NOT apply any ZAR-prefix transformation here. Only the two cashback
  // amount fields (handled in the branch above) are currency-driven.
  return {
    label: t(`fieldPreview.${field}.label`),
    value: t(`fieldPreview.${field}.value`),
  };
}

export function PassCardPreviewBody({
  textColor,
  compact,
  leftField,
  rightField,
  stampGridRows,
  cardType,
  rewardName,
  firstRewardTierName,
  firstCashbackTierName,
  firstMembershipTierName,
}: PassCardPreviewBodyProps) {
  const { t } = useTranslation('passCard');

  // Currency awareness (2026-09-13 ZAR pollution fix): read the current
  // card currency from the editor store so the two cashback amount fields
  // (`pointsToNextTierCashback`, `accumulatedSpendCashback`) can source
  // their value from `CASHBACK_PREVIEW_AMOUNTS[currency]`. All other
  // fields are currency-agnostic demo data — they do NOT receive any ZAR
  // prefix transformation. The previous regex-based formatter (which
  // contaminated every i18n-sourced value) has been removed.
  const currency = useCardBuilderStore((s) => s.currency);

  // Demo label/value 配對（PassCreator Label + Value 格式）
  const leftPreview = resolveSlot(
    t,
    leftField,
    stampGridRows,
    cardType,
    rewardName,
    firstRewardTierName,
    firstCashbackTierName,
    firstMembershipTierName,
    currency,
  );
  const rightPreview = resolveSlot(
    t,
    rightField,
    stampGridRows,
    cardType,
    rewardName,
    firstRewardTierName,
    firstCashbackTierName,
    firstMembershipTierName,
    currency,
  );

  // PassCreator typography: label 永遠比 value 小。
  //   非 compact：label 10px / value 14px（差 4px，1.4x 視覺層級）
  //   compact  ：label 8px  / value 11px（差 3px，手機框架內仍保留層級）
  const labelClass = compact ? 'text-[8px]' : 'text-[10px]';
  const valueClass = compact
    ? 'text-[11px] font-medium truncate'
    : 'text-sm font-medium';

  // BARCODE PLACEMENT — 2026-09-10 第五次修正:
  //   把 body 改成 `flex-1`,讓中間空白被 body 內部吃掉,footer 自然被擠到
  //   卡片底邊。這比繼續壓 footer 的 pb 更貼近真實 Apple Wallet pass
  //   (上半部資訊 + 底邊 barcode,中間留白是設計語言,不是 bug)。
  //   為什麼 flex-1 對:card 內層是 `flex flex-col`,沒有 flex-1 的話所有
  //   子元素都按 natural height 堆疊,footer 會停在 body 後面(離卡片底邊
  //   還有 264px 空白)。body 加 flex-1 後,中間空白被 body 內部吃掉,
  //   body 內部 content(label/value)因 flex-col 預設 justify-start
  //   黏在 body 頂部 = strip 下方,footer 自然被推到卡片底邊。
  //   維持不變:mt-4 gap from strip,px-4,gap-2 內部間距,footer 的 pt-1 pb-1。
  //
  //   2026-09-10 第六次修正: 移除上下兩條 1px `bg-neutral-200` 分隔線。
  //   真實 Apple Wallet pass 的 secondary field rows 之間沒有分隔線 —
  //   純粹是白底 label/value,視覺層級由 typography hierarchy（label 10px
  //   vs value 14px/font-medium）撐出來。h-px 元素直接從 DOM 移除，比
  //   改成 bg-transparent 更乾淨（無意義的 1px 元素）。
  return (
    <div className={compact ? 'mt-2 flex flex-1 flex-col gap-1 px-2' : 'mt-4 flex flex-1 flex-col gap-2 px-4'}>
      {/* 左右欄位 — 兩欄並排 (flex-row)，每欄 L & V 垂直排列 (flex-col)。
          對應 PassCreator secondary field 格式：左欄 [label / value]、右欄 [label / value]。 */}
      <div className={compact ? 'flex flex-row items-start justify-between gap-3 py-0.5' : 'flex flex-row items-start justify-between gap-4 py-1'}>
        {/* 左欄位 column：label（small, top）+ value（larger font-medium, bottom） */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* 左 label — textColor 套用範圍 */}
          <span
            className={labelClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {leftPreview.label}
          </span>
          {/* 左 value — textColor 套用範圍 */}
          <span
            className={valueClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {leftPreview.value}
          </span>
        </div>

        {/* 右欄位 column：label（small, top）+ value（larger font-medium, bottom） — 結構對稱 */}
        <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
          {/* 右 label — textColor 套用範圍 */}
          <span
            className={labelClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {rightPreview.label}
          </span>
          {/* 右 value — textColor 套用範圍 */}
          <span
            className={valueClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {rightPreview.value}
          </span>
        </div>
      </div>

      {/* 移除底部分隔線 (2026-09-10 第六次修正)
          真實 Apple Wallet pass 的 footer 沒有上方分隔線 — barcode 區塊
          直接接在 body 後面。 */}
    </div>
  );
}
