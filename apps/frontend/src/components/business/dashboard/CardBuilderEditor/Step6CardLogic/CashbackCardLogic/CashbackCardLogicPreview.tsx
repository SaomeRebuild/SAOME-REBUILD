/**
 * CashbackCardLogicPreview — Step 6 live preview of the cashback scenario.
 *
 * Composes a human-readable sentence describing the cashback card rule
 * based on the FIRST tier (lowest threshold, since `cashbackTiers` is
 * sorted ASC on load via `loadSettings`).
 *
 * Special handling for threshold = 0 ("default tier"):
 *   - threshold === 0 → "不限消費金額享 5% 現金回饋" / "Earn 5% cashback on every purchase"
 *   - threshold > 0  → "累計消費滿 1000 享 5% 現金回饋" / "Spend 1000 to earn 5% cashback"
 *
 * Currency placement convention (ISO 4217 / locale usage):
 *   - ZAR: prefix always (R50) regardless of locale
 *   - TWD zh-TW: suffix (50元)
 *   - TWD en: prefix (NT$50)
 *
 * Example outputs (en, TWD): "Spend NT$1000 to earn 5% cashback"
 * Example outputs (en, ZAR): "Spend R1000 to earn 5% cashback"
 * Example outputs (zh-TW, TWD): "累計消費滿 1000元 享 5% 現金回饋"
 * Example outputs (zh-TW, ZAR): "累計消費滿 R1000 享 5% 現金回饋"
 * Example with threshold=0: "不限消費金額享 1% 現金回饋" / "Earn 1% cashback on every purchase"
 * Example empty: "請新增至少一組現金回饋級距" / "Please add at least one cashback tier"
 *
 * Purely a UI preview — does NOT call any API or persist data.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

export function CashbackCardLogicPreview() {
  const { t, i18n } = useTranslation('cardEditor');
  const cashbackTiers = useCardBuilderStore((s) => s.cashbackTiers);
  const currency = useCardBuilderStore((s) => s.currency);

  // Pick the first valid tier (lowest threshold) for preview.
  // "Valid" = tier has name + thresholdSpend (≥ 0) + cashbackPercent (1-100).
  const validTier = cashbackTiers.find(
    (tier) =>
      tier.name.trim() !== '' &&
      tier.thresholdSpend >= 0 &&
      tier.cashbackPercent >= 1 &&
      tier.cashbackPercent <= 100,
  );

  const tierToShow = validTier ?? cashbackTiers[0];
  const isIncomplete = !tierToShow || !validTier;

  // Currency-aware formatting of the threshold amount. Mirrors RewardCardLogicPreview
  // helper convention (unit placement follows ISO 4217 / locale usage).
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const amountUnitTWD = t('step6.cashback.tier.thresholdUnitTWD');
  const amountUnitZAR = t('step6.cashback.tier.thresholdUnitZAR');

  const formatAmount = (value: number): string => {
    if (isZAR) return `${amountUnitZAR}${value}`;
    return isZhLocale ? `${value}${amountUnitTWD}` : `${amountUnitTWD}${value}`;
  };

  // Build the sentence based on the tier's threshold value.
  // threshold === 0 → noThreshold template (no amount shown).
  // threshold > 0   → withThreshold template (with locale-correct currency amount).
  const buildSentence = (tier: {
    name: string;
    thresholdSpend: number;
    cashbackPercent: number;
  }): string => {
    if (tier.thresholdSpend === 0) {
      return t('step6.cashback.preview.noThreshold', {
        percent: tier.cashbackPercent,
      });
    }
    return t('step6.cashback.preview.withThreshold', {
      amount: formatAmount(tier.thresholdSpend),
      percent: tier.cashbackPercent,
    });
  };

  const fullSentence = isIncomplete || !tierToShow ? '' : buildSentence(tierToShow);

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {/* Scenario text card — same pattern as RewardCardLogicPreview */}
      <div
        className={`
          flex min-h-[3rem] items-center rounded-lg border px-4 py-3
          ${isIncomplete
            ? 'border-dashed border-border bg-muted/30'
            : 'border-primary/30 bg-primary/5'
          }
        `}
      >
        {isIncomplete ? (
          <p className="text-sm text-muted-foreground">
            {t('step6.cashback.preview.tierUnknown')}
          </p>
        ) : (
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {fullSentence}
          </p>
        )}
      </div>
    </section>
  );
}
