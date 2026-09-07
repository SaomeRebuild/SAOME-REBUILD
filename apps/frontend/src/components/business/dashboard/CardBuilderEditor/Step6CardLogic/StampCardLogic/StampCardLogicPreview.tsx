/**
 * StampCardLogicPreview — Step 6 live preview of the reward scenario.
 *
 * Composes a human-readable sentence describing the stamp card reward rule.
 * Example outputs:
 *   - "集滿 10 個印章可兌換 $10 元折價"
 *   - "集滿 10 個印章可兌換 8% 折扣，最高折抵 $50 元"
 *   - "請選擇蓋章方式"
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
  const { t } = useTranslation('cardEditor');
  const accrualMode = useCardBuilderStore((s) => s.stampAccrualMode);
  const rewardName = useCardBuilderStore((s) => s.rewardName);
  const rewardType = useCardBuilderStore((s) => s.rewardType);
  const rewardValue = useCardBuilderStore((s) => s.rewardValue);
  const maxDiscountAmount = useCardBuilderStore((s) => s.maxDiscountAmount);

  // Build the reward display string based on current selections
  const buildRewardStr = (): string => {
    if (!rewardName.trim()) return rewardName; // empty → placeholder shown separately

    if (rewardType === 'amount_off' && rewardValue !== null && rewardValue > 0) {
      return t('step6.stamp.preview.amountReward', { amount: rewardValue });
    }

    if (rewardType === 'percent_off' && rewardValue !== null && rewardValue > 0) {
      if (maxDiscountAmount !== null && maxDiscountAmount > 0) {
        return t('step6.stamp.preview.percentWithCap', {
          percent: rewardValue,
          cap: maxDiscountAmount,
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
