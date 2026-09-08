/**
 * RewardCardLogicPreview — Step 6 live preview of the reward scenario.
 *
 * Composes a human-readable sentence describing the reward card rule based on
 * the FIRST tier (lowest threshold, since `rewardTiers` is sorted on load).
 *
 * 2026-09-09 mixed refactor: `earningMode` is CARD-WIDE (read from the
 * store root). Each tier still owns its own earn rate fields (pointsPerVisit
 * / pointsPerSpendAmount / pointsPerSpendPoints) but the mode itself is
 * one per card.
 *
 * 2026-09-09 i18n fix (mixed-language bleed): reward fragments are routed
 * through i18n keys (`step6.reward.preview.amountReward` /
 * `.percentReward` / `.amountWithCap` / `.percentWithCap` / `.percentNoCap`)
 * instead of hardcoded Chinese words (`折價` / `折扣` / `最高折抵`). The
 * currency unit (元 / NT$ / R) is pre-baked into the amount string at the
 * correct position (suffix for zh-TW TWD, prefix for everything else) and
 * passed as the `{{amount}}` / `{{cap}}` interpolation variable — so the
 * locale template stays free of currency symbols and pure locale phrasing.
 *
 * Currency placement convention (ISO 4217 / locale usage):
 *   - ZAR:  prefix always (R50) regardless of locale
 *   - TWD zh-TW: suffix (50元)
 *   - TWD en: prefix (NT$50)
 *
 * Example outputs (en, TWD): "Earn 1500 points to redeem NT$50 off"
 * Example outputs (en, ZAR): "Earn 1500 points to redeem R50 off"
 * Example outputs (zh-TW, TWD): "集滿 1500 點可兌換 50元折價"
 * Example outputs (zh-TW, ZAR): "集滿 1500 點可兌換 R50折價"
 * Example incomplete: "請設定獎勵級距" / "Please set up at least one reward tier"
 *
 * The preview reads `rewardTiers[0]` (or the first valid tier) — multiple
 * tiers' preview is OUT OF SCOPE for this iteration (UI keeps the same
 * single-sentence pattern as StampCardLogic for consistency).
 *
 * Purely a UI preview — does NOT call any API or persist data.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

export function RewardCardLogicPreview() {
  const { t, i18n } = useTranslation('cardEditor');
  const rewardTiers = useCardBuilderStore((s) => s.rewardTiers);
  const currency = useCardBuilderStore((s) => s.currency);
  // 2026-09-09 mixed refactor: earningMode is CARD-WIDE (top-level).
  const cardWideEarningMode = useCardBuilderStore((s) => s.earningMode);

  // 2026-09-09 i18n fix: route the reward fragment through i18n keys
  // (no hardcoded Chinese fragments leaking into the English render).
  // Currency unit (元 / NT$ / R) is pre-formatted into the amount string
  // before being passed as `{{amount}}` / `{{cap}}` to the i18n template —
  // the template then provides ONLY the locale-correct phrasing.
  //
  // Placement convention (ISO 4217 / locale usage):
  //   - ZAR: prefix always (R50 / R50) regardless of locale
  //   - TWD zh-TW: suffix (50元)
  //   - TWD en: prefix (NT$50)
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const amountUnitTWD = t('step6.reward.tier.rewardValueAmountUnitTWD');
  const amountUnitZAR = t('step6.reward.tier.rewardValueAmountUnitZAR');

  // 2026-09-09 helper: format a numeric amount with the currency unit in
  // locale-correct position. Used to pre-bake the amount string before it
  // is interpolated into the i18n template, so the template stays free of
  // currency symbols and pure locale-phrasing.
  const formatAmount = (value: number): string => {
    if (isZAR) return `${amountUnitZAR}${value}`;
    return isZhLocale ? `${value}${amountUnitTWD}` : `${amountUnitTWD}${value}`;
  };

  const buildRewardStr = (tier: {
    name: string;
    rewardType: 'amount_off' | 'percent_off' | null | undefined;
    rewardValue: number | null | undefined;
    maxDiscountAmount: number | null | undefined;
  }): string => {
    if (!tier.name.trim()) return tier.name; // empty → placeholder shown separately

    if (tier.rewardType === 'amount_off' && tier.rewardValue !== null && tier.rewardValue !== undefined && tier.rewardValue > 0) {
      return t('step6.reward.preview.amountReward', {
        amount: formatAmount(tier.rewardValue),
      });
    }

    if (tier.rewardType === 'percent_off' && tier.rewardValue !== null && tier.rewardValue !== undefined && tier.rewardValue > 0) {
      if (tier.maxDiscountAmount !== null && tier.maxDiscountAmount !== undefined && tier.maxDiscountAmount > 0) {
        return t('step6.reward.preview.percentWithCap', {
          percent: tier.rewardValue,
          cap: formatAmount(tier.maxDiscountAmount),
        });
      }
      return t('step6.reward.preview.percentNoCap', { percent: tier.rewardValue });
    }

    // rewardType not yet selected — just show the name
    return tier.name;
  };

  // Pick the first valid tier (lowest threshold) for preview.
  // "Valid" = tier has identity (name/threshold/rewardType/rewardValue).
  // Per-tier earn rate fields are NOT part of preview validity — only the
  // card-wide earningMode matters for the preview's "is the user done?" gate.
  const validTier = rewardTiers.find(
    (tier) =>
      tier.threshold > 0 &&
      tier.rewardType !== null &&
      tier.rewardValue !== null &&
      tier.rewardValue !== undefined &&
      tier.rewardValue > 0,
  );

  const tierToShow = validTier ?? rewardTiers[0];

  // 2026-09-09 mixed refactor: earningMode is CARD-WIDE.
  const hasMode = cardWideEarningMode !== null && cardWideEarningMode !== undefined;
  const hasTier = !!tierToShow;
  const tierComplete =
    hasTier &&
    tierToShow.name.trim() !== '' &&
    tierToShow.threshold > 0 &&
    tierToShow.rewardType !== null &&
    tierToShow.rewardValue !== null &&
    tierToShow.rewardValue !== undefined &&
    tierToShow.rewardValue > 0;

  // 2026-09-09 priority order: tier identity (hasTier / tierComplete)
  // takes precedence over card-wide earningMode. If there's no tier OR
  // the tier identity is incomplete, we show tierUnknown — even if a
  // different tier's earn rate would otherwise be set. The preview reads
  // from the FIRST valid tier (or fallback tierToShow[0]), so missing-tier
  // and incomplete-tier messages correctly override the mode prompt.
  const isIncomplete = !hasTier || !tierComplete || !hasMode;
  const rewardStr = tierToShow ? buildRewardStr(tierToShow) : '';
  const fullSentence =
    isIncomplete || !tierToShow
      ? ''
      : t('step6.reward.preview.template', {
          threshold: tierToShow.threshold,
          reward: rewardStr,
        });

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {/* Scenario text card — same pattern as StampCardLogicPreview */}
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
            {/* Priority order: tier identity first, then card-wide earningMode. */}
            {!hasTier || !tierComplete
              ? t('step6.reward.preview.tierUnknown')
              : t('step6.reward.preview.modeUnknown')}
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
