/**
 * StampCardLogicPreview — Step 6 live preview of the reward scenario.
 *
 * Composes a human-readable sentence describing the stamp card reward rule.
 * Example outputs:
 *   - "集滿 10 個印章可兌換 10元折價"
 *   - "集滿 10 個印章可兌換 R10折價"
 *   - "集滿 15 個印章可兌換 8%折扣，最高折抵 R50"
 *   - "請選擇蓋章方式"
 *
 * 2026-09-10 currency-aware preview: amount / cap are pre-formatted with
 * the currency unit at the correct position (suffix 元 for zh-TW TWD,
 * prefix R / NT$ for everything else) before being interpolated into the
 * locale template. The template then provides ONLY locale-correct
 * phrasing — no currency symbols embedded. Mirrors REWARD preview.
 *
 * This is purely a UI preview — it does NOT call any API or persist data.
 * The preview text is computed from store values and i18n template strings.
 *
 * Placed at the bottom of the StampCardLogic editor so the user can
 * see the combined effect of all their choices before advancing.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

interface StampCardLogicPreviewProps {
  /** Total number of stamp cells = stampGridRows × 5 */
  stampTotal: number;
}

export function StampCardLogicPreview({ stampTotal }: StampCardLogicPreviewProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const accrualMode = useCardBuilderStore((s) => s.stampAccrualMode);
  const rewardName = useCardBuilderStore((s) => s.rewardName);
  const rewardType = useCardBuilderStore((s) => s.rewardType);
  const rewardValue = useCardBuilderStore((s) => s.rewardValue);
  const maxDiscountAmount = useCardBuilderStore((s) => s.maxDiscountAmount);
  // 2026-09-10 currency-aware preview formatting.
  const currency = useCardBuilderStore((s) => s.currency);

  // 2026-09-10: pre-format numeric amounts with currency unit at the
  // correct position. ZAR always prefix (R50). TWD zh-TW: suffix (50元).
  // TWD en: prefix (NT$50). Mirrors RewardCardLogicPreview.formatAmount.
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitTWD = t('step6.stamp.rewardValueAmountUnitTWD');
  const unitZAR = t('step6.stamp.rewardValueAmountUnitZAR');
  const formatAmount = (value: number): string => {
    if (isZAR) return `${unitZAR}${value}`;
    return isZhLocale ? `${value}${unitTWD}` : `${unitTWD}${value}`;
  };

  // Build the reward display string based on current selections
  const buildRewardStr = (): string => {
    if (!rewardName.trim()) return rewardName; // empty → placeholder shown separately

    if (rewardType === 'amount_off' && rewardValue !== null && rewardValue > 0) {
      // 2026-09-10: pre-format amount with currency unit before passing
      // to i18n template. Template provides only locale phrasing.
      return t('step6.stamp.preview.amountReward', {
        amount: formatAmount(rewardValue),
      });
    }

    if (rewardType === 'percent_off' && rewardValue !== null && rewardValue > 0) {
      if (maxDiscountAmount !== null && maxDiscountAmount > 0) {
        return t('step6.stamp.preview.percentWithCap', {
          percent: rewardValue,
          cap: formatAmount(maxDiscountAmount),
        });
      }
      return t('step6.stamp.preview.percentNoCap', { percent: rewardValue });
    }

    // rewardType not yet selected — just show the name
    return rewardName;
  };

  const isIncomplete = !accrualMode || !rewardName.trim();
  const rewardStr = buildRewardStr();
  const fullSentence = isIncomplete
    ? ''
    : t('step6.stamp.preview.template', {
        total: stampTotal,
        reward: rewardStr,
      });

  return (
    <section className="flex min-w-0 flex-col gap-2">
      {/* The preview card itself is the only thing the user sees here —
          "Reward Settings" was just the conversational grouping the user
          used when explaining the Step 6 structure; per user request
          (2026-09-07) the section label is intentionally omitted so the
          card stands alone, not as a labelled "Reward Settings" section. */}
      {/* Scenario text card */}
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
            {!accrualMode
              ? t('step6.stamp.preview.modeUnknown')
              : t('step6.stamp.preview.rewardUnknown')}
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
