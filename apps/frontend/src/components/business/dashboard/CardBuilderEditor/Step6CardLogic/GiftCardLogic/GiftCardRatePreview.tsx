/**
 * GiftCardRatePreview — Live exchange rate display.
 *
 * 2026-09-27 (initial): New for gift_card editor. Shows the current
 * exchange rate as a single line.
 *
 * 2026-09-27 (Round 2 — currency placement fix): Refactor to
 * pre-format the amount + unit string in the component so currencies
 * with prefix convention (ZAR "R", TWD en "NT$") render correctly.
 * Previously the i18n template `{{amount}} {{unit}}` hardcoded suffix
 * style, producing "12 R = 1 點" for ZAR — wrong, since Rand symbol
 * belongs BEFORE the amount. Now uses prefix/suffix logic that
 * mirrors GiftCardAmountField exactly, keeping the input field and
 * preview line consistent.
 *
 * 4 currency × locale cases (validated):
 *   - TWD zh-TW: "100 元 = 100 點"      (suffix 元)
 *   - TWD en:    "NT$ 100 = 100 pts"   (prefix NT$)
 *   - ZAR zh-TW: "R 100 = 100 點"      (prefix R, no suffix)
 *   - ZAR en:    "R 100 = 100 pts"     (prefix R, no suffix)
 *
 * When either field is invalid (≤ 0 or not a finite integer), the
 * preview does NOT render — defensive guard so we never show
 * "0 元 = 0 點" mid-edit.
 *
 * Uses i18n template `step6.gift.ratePreview` with placeholder
 * {amountWithUnit} + {points}; react-i18next's interpolation handles
 * the substitution automatically when called via `t(key, options)`.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

export function GiftCardRatePreview() {
  const { t, i18n } = useTranslation('cardEditor');
  const giftCardAmount = useCardBuilderStore((s) => s.giftCardAmount);
  const giftCardPoints = useCardBuilderStore((s) => s.giftCardPoints);
  const currency = useCardBuilderStore((s) => s.currency);

  // Defensive: don't render if either value is invalid. Mirrors the
  // store setter guards (> 0, integer, finite). Corrupted DB rows could
  // surface 0 / NaN through loadSettings, so the preview stays hidden
  // until the user types a valid value.
  const amountValid =
    typeof giftCardAmount === 'number' &&
    Number.isFinite(giftCardAmount) &&
    Number.isInteger(giftCardAmount) &&
    giftCardAmount > 0;
  const pointsValid =
    typeof giftCardPoints === 'number' &&
    Number.isFinite(giftCardPoints) &&
    Number.isInteger(giftCardPoints) &&
    giftCardPoints > 0;

  if (!amountValid || !pointsValid) return null;

  // Currency-aware unit placement (mirrors GiftCardAmountField pattern
  // exactly — keep the prefix/suffix logic in sync between input
  // field and preview so they never disagree):
  //   - TWD zh-TW: suffix 元       → "100 元"
  //   - TWD en:    prefix NT$      → "NT$ 100"
  //   - ZAR:       prefix R        → "R 100"  (both zh-TW and en)
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.gift.amountUnitZAR')
    : !isZhLocale
    ? t('step6.gift.amountUnitTWD')   // en TWD: "NT$" prefix
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.gift.amountUnitTWD')   // zh-TW TWD: "元" suffix
    : '';

  // Pre-format the amount with its unit. The template only sees a
  // single {amountWithUnit} string so the position of the unit is
  // fully controlled here — keeps the i18n template agnostic to
  // currency placement conventions.
  const amountWithUnit = unitPrefix
    ? `${unitPrefix} ${giftCardAmount}`        // "R 100" / "NT$ 100"
    : `${giftCardAmount} ${unitSuffix}`.trim(); // "100 元"

  return (
    <div
      className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm"
      data-testid="gift-rate-preview"
    >
      <span className="font-medium text-foreground">
        {t('step6.gift.ratePreview', {
          amountWithUnit,
          points: giftCardPoints,
        })}
      </span>
    </div>
  );
}