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
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention. TWD keeps suffix
 * notation (元 after) per zh-TW convention. EN uses prefix for both
 * (NT$50 / R50). The buildRewardStr() helper conditionally orders the unit
 * symbol around the amount.
 *
 * Example outputs (zh-TW):
 *   - "集滿 1000 點可兌換 500點折抵50元"   (TWD amount_off)
 *   - "集滿 500 點可兌換 10%折扣，最高折抵 R50"   (ZAR percent_off with cap)
 *   - "請選擇累積方式" (when card-wide earningMode is null but tier identity is complete)
 *   - "請設定獎勵級距"
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
  const { t } = useTranslation('cardEditor');
  const rewardTiers = useCardBuilderStore((s) => s.rewardTiers);
  const currency = useCardBuilderStore((s) => s.currency);
  // 2026-09-09 mixed refactor: earningMode is CARD-WIDE (top-level).
  const cardWideEarningMode = useCardBuilderStore((s) => s.earningMode);

  // Build the reward display string for a single tier (called with the first valid tier).
  //
  // 2026-09-09 currency placement fix: ZAR uses prefix (R first, amount
  // after); TWD keeps suffix (amount first, 元 after). Both compositions
  // read the unit via i18n so the actual symbol is locale-correct (zh-TW
  // 元/NT$ R, en NT$ / R — both EN currencies are prefix-style).
  const isZAR = currency === 'ZAR';
  const amountUnitTWD = t('step6.reward.tier.rewardValueAmountUnitTWD');
  const amountUnitZAR = t('step6.reward.tier.rewardValueAmountUnitZAR');
  const capUnitTWD = t('step6.reward.tier.maxDiscountUnitTWD');
  const capUnitZAR = t('step6.reward.tier.maxDiscountUnitZAR');

  const buildRewardStr = (tier: {
    name: string;
    rewardType: 'amount_off' | 'percent_off' | null | undefined;
    rewardValue: number | null | undefined;
    maxDiscountAmount: number | null | undefined;
  }): string => {
    if (!tier.name.trim()) return tier.name; // empty → placeholder shown separately

    if (tier.rewardType === 'amount_off' && tier.rewardValue !== null && tier.rewardValue !== undefined && tier.rewardValue > 0) {
      // TWD: 50元折價 / ZAR: R50折價
      return isZAR
        ? `${amountUnitZAR}${tier.rewardValue}折價`
        : `${tier.rewardValue}${amountUnitTWD}折價`;
    }

    if (tier.rewardType === 'percent_off' && tier.rewardValue !== null && tier.rewardValue !== undefined && tier.rewardValue > 0) {
      if (tier.maxDiscountAmount !== null && tier.maxDiscountAmount !== undefined && tier.maxDiscountAmount > 0) {
        // TWD: 折抵 50元 / ZAR: 折抵 R50
        const capStr = isZAR
          ? `${capUnitZAR}${tier.maxDiscountAmount}`
          : `${tier.maxDiscountAmount}${capUnitTWD}`;
        return `${tier.rewardValue}%折扣，最高折抵 ${capStr}`;
      }
      return `${tier.rewardValue}%折扣，無折抵上限`;
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
