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
 */
import { useTranslation } from 'react-i18next';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { CardType } from '@saome/shared/schemas/card';
import {
  STAMPS_PER_ROW,
  type StampGridRows,
} from '@/components/business/stampCard/StampGridPreview';

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
   * `memberLevel` preview slot when cardType is `'stamp_card'` or
   * `'reward_card'` (see module docblock § "Stamp / Reward card
   * member-level → reward override"). Optional — when omitted,
   * `resolveSlot` falls through to the default label/value path so
   * non-stamp contexts (TemplateCardPreview, etc.) keep working.
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
   * stamp_card empty-string UX). Differs from `rewardName` only in the data
   * source: reward_card has a multi-tier structure so we read the FIRST tier's
   * name instead of a top-level string.
   * (2026-09-10 reward card member-level → reward refactor extension.)
   */
  firstRewardTierName?: string;
}

/**
 * Resolve a preview slot's {label, value} pair given the field key + stamp
 * context + cardType.
 *
 * Branch order matters:
 *   1. `!field`                  → placeholder (左欄位 / 右欄位)
 *   2. `stamp_card + memberLevel` → stamp-card override (label = stampLabel,
 *                                   value = rewardName ?? '')
 *   3. `reward_card + memberLevel` → reward-card override (label = stampLabel,
 *                                   value = firstRewardTierName ?? '')
 *   4. `totalStamps`             → rows × STAMPS_PER_ROW interpolation
 *   5. default                   → `fieldPreview.{key}.label` + `.value`
 *
 * The stamp/reward-card branches are checked BEFORE the `totalStamps`
 * branch because `memberLevel` is a `common`-group field and could
 * conceptually appear alongside `totalStamps` in the two slots; the
 * member-level override is the more specific case.
 */
function resolveSlot(
  t: (key: string, opts?: Record<string, unknown>) => string,
  field: CardFieldKey | null | undefined,
  stampGridRows: StampGridRows | undefined,
  cardType: CardType | null | undefined,
  rewardName: string | undefined,
  firstRewardTierName: string | undefined,
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
}: PassCardPreviewBodyProps) {
  const { t } = useTranslation('passCard');

  // Demo label/value 配對（PassCreator Label + Value 格式）
  const leftPreview = resolveSlot(
    t,
    leftField,
    stampGridRows,
    cardType,
    rewardName,
    firstRewardTierName,
  );
  const rightPreview = resolveSlot(
    t,
    rightField,
    stampGridRows,
    cardType,
    rewardName,
    firstRewardTierName,
  );

  // PassCreator typography: label 永遠比 value 小。
  //   非 compact：label 10px / value 14px（差 4px，1.4x 視覺層級）
  //   compact  ：label 8px  / value 11px（差 3px，手機框架內仍保留層級）
  const labelClass = compact ? 'text-[8px]' : 'text-[10px]';
  const valueClass = compact
    ? 'text-[11px] font-medium truncate'
    : 'text-sm font-medium';

  return (
    <div className={compact ? 'mt-2 flex flex-col gap-1 px-2' : 'mt-4 flex flex-col gap-2 px-4'}>
      {/* 分隔線 - Apple Pass 風格 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />

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

      {/* 底部分隔線 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />
    </div>
  );
}
