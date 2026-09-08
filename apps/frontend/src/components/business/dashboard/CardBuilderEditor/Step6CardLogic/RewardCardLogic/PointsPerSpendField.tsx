/**
 * PointsPerSpendField — Reward tier sub-field 0c (基於消費門檻).
 *
 * 2026-09-09 mixed refactor: this field stays INSIDE each RewardTierRow,
 * but is now CONDITIONAL on the CARD-WIDE `earningMode` (top-level)
 * instead of `tier.earningMode`. Read/write goes through
 * `updateRewardTier(tierId, { pointsPerSpendAmount })` and
 * `updateRewardTier(tierId, { pointsPerSpendPoints })`.
 *
 * 2026-09-09 copy update: the field reads
 *   "每消費 [N] 元 = 獲得 [M] 個點數"
 * with placeholders "例如：100" and "例如：1" so the user can see exactly
 * what each input slot maps to. The previous copy ("元獲得") was unclear.
 *
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention. TWD keeps suffix
 * (元 after) per zh-TW convention. The row renders as:
 *   TWD: 每消費 [input] 元   (suffix 元)
 *   ZAR: 每消費 R [input]     (prefix R)
 *
 * Renders only when:
 *   - The tierId resolves to a row in `rewardTiers`.
 *   - The top-level `earningMode === 'based_on_spending'`.
 *
 * Renders two `<input type="number">` for setting the spend-points ratio:
 *   - pointsPerSpendAmount (元 — currency amount)
 *   - pointsPerSpendPoints (個點數 — points earned)
 *
 * Behavior:
 *   - Store rejects ≤ 0 (spend amount) and < 1 (points).
 *   - `null` is accepted — means "not set yet".
 *   - Validation errors surface when `showValidation=true` AND either field is null.
 *
 * Formula reference (mu-plugins `SAOME-Points-Engine/modules/cards/reward-card.php`):
 *   `$awarded = floor(amount / spend_amount) × points_earned`
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { PointsPerSpendFieldProps } from './RewardCardLogic.types';

export function PointsPerSpendField({ showValidation, tierId }: PointsPerSpendFieldProps) {
  const { t } = useTranslation('cardEditor');
  // 2026-09-09 mixed refactor: earningMode is CARD-WIDE (top-level), read
  // from the store root instead of `tier.earningMode`.
  const earningMode = useCardBuilderStore((s) => s.earningMode);
  // 2026-09-09 currency placement fix: read store.currency to decide
  // whether the unit symbol is rendered as a prefix (ZAR R) or suffix
  // (TWD 元) around the spend-amount input.
  const currency = useCardBuilderStore((s) => s.currency);
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  // Only shown for card-wide based_on_spending mode.
  if (earningMode !== 'based_on_spending') return null;

  // 2026-09-09: currency-aware unit placement.
  // TWD keeps zh-TW suffix 元; ZAR uses prefix R (South African Rand
  // convention). EN TWD keeps suffix 'spent' (verb complement); ZAR
  // keeps prefix R. See cardEditor.{zh-TW,en}.ts `pointsPerSpend`.
  const isZAR = currency === 'ZAR';
  const amountUnitPrefix = isZAR ? t('step6.reward.pointsPerSpend.amountUnitZAR') : '';
  const amountUnitSuffix = isZAR ? '' : t('step6.reward.pointsPerSpend.amountUnitTWD');

  const pointsPerSpendAmount = tier.pointsPerSpendAmount ?? null;
  const pointsPerSpendPoints = tier.pointsPerSpendPoints ?? null;

  const showError =
    showValidation &&
    (pointsPerSpendAmount === null || pointsPerSpendPoints === null);

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h4
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.reward.pointsPerSpend.title')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t('step6.reward.pointsPerSpend.helper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        {/* Row 1: amount = N 元（每消費金額）
            2026-09-09 copy update: "每消費 [N] 元" with placeholder "例如：100".
            2026-09-09 currency placement fix: TWD keeps 元 suffix; ZAR moves
            R to the prefix (renders R before the input). */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerSpend.amountLabel')}
          </span>
          {amountUnitPrefix && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {amountUnitPrefix}
            </span>
          )}
          <input
            id={`step6-tier-${tierId}-points-per-spend-amount`}
            type="number"
            inputMode="decimal"
            value={pointsPerSpendAmount ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                updateRewardTier(tierId, { pointsPerSpendAmount: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num <= 0) return; // store rejects ≤ 0
              updateRewardTier(tierId, { pointsPerSpendAmount: num });
            }}
            placeholder={t('step6.reward.pointsPerSpend.amountPlaceholder')}
            min={0.01}
            aria-label={t('step6.reward.pointsPerSpend.amountLabel')}
            aria-invalid={showError}
            className={`
              flex h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          {amountUnitSuffix && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {amountUnitSuffix}
            </span>
          )}
        </div>

        {/* Row 2: = 獲得 M 個點數
            2026-09-09 copy update: "= 獲得 [M] 個點數" with placeholder "例如：
            1" (user explicitly asked for "獲得 M 個點數" pattern). */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerSpend.equalLabel')}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerSpend.earnLabel')}
          </span>
          <input
            id={`step6-tier-${tierId}-points-per-spend-points`}
            type="number"
            inputMode="numeric"
            value={pointsPerSpendPoints ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                updateRewardTier(tierId, { pointsPerSpendPoints: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num < 1) return; // store rejects < 1
              updateRewardTier(tierId, { pointsPerSpendPoints: num });
            }}
            placeholder={t('step6.reward.pointsPerSpend.pointsPlaceholder')}
            min={1}
            aria-label={t('step6.reward.pointsPerSpend.pointsLabel')}
            aria-invalid={showError}
            className={`
              flex h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {/* 2026-09-09 copy: user asked for "獲得 M 個點數" (so the suffix
                is "個點數", not just "點"). Use pointsLabel key. */}
            {t('step6.reward.pointsPerSpend.pointsLabel')}
          </span>
        </div>

        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.reward.pointsPerSpend.requiredError')}
          </p>
        )}
      </div>
    </section>
  );
}
