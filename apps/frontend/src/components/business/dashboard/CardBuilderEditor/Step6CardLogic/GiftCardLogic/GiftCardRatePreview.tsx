/**
 * GiftCardRatePreview — Live exchange rate display.
 *
 * 2026-09-27: New for gift_card editor. Shows the current exchange rate
 * as a single line: "[amount] [unit] = [points] 點" / "[amount] [unit] =
 * [points] pts". When either field is invalid (≤ 0 or not a finite
 * integer), the preview does NOT render — defensive guard so we never
 * show "0 元 = 0 點" mid-edit.
 *
 * Uses the i18n template `step6.gift.ratePreview` with placeholders
 * {amount}, {unit}, {points} — react-i18next's interpolation handles the
 * substitution automatically when called via `t(key, options)`.
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

  // Currency-aware unit (mirrors GiftCardAmountField pattern):
  //   - TWD zh-TW: 後綴 "元" → "100 元 = 100 點"
  //   - TWD en:    前綴 "NT$" → "Spend NT$100 = 100 pts"
  //   - ZAR:       前綴 "R" → "Spend R100 = 100 pts"
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unit =
    isZAR
      ? t('step6.gift.amountUnitZAR')
      : !isZhLocale
      ? t('step6.gift.amountUnitTWD') // NT$ prefix for en TWD
      : isZhLocale
      ? t('step6.gift.amountUnitTWD') // 元 suffix for zh-TW TWD
      : '';

  return (
    <div
      className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm"
      data-testid="gift-rate-preview"
    >
      <span className="font-medium text-foreground">
        {t('step6.gift.ratePreview', {
          amount: giftCardAmount,
          unit,
          points: giftCardPoints,
        })}
      </span>
    </div>
  );
}