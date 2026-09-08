/**
 * PointsPerVisitField — Reward tier sub-field 0b (基於拜訪門檻).
 *
 * 2026-09-09 mixed refactor: this field is now CONDITIONAL on the
 * CARD-WIDE `earningMode` (one mode per card, decided by the top-level
 * `<EarningModeField />`). The earn rate (`pointsPerVisit`) stays PER-TIER
 * — each tier can have its own rate under the same card-wide mode
 * (e.g. tier-1 = 1 visit = 1 point; tier-2 = 1 visit = 2 points).
 *
 * Renders only when:
 *   - The tierId resolves to a row in `rewardTiers`.
 *   - The top-level `earningMode === 'based_on_visits'`.
 *
 * Behavior:
 *   - Store rejects ≤ 0 (backend zod `.int().min(1)` is the authoritative gate).
 *   - `null` is accepted — means "not set yet".
 *   - Validation errors surface when `showValidation=true` AND pointsPerVisit is null.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { PointsPerVisitFieldProps } from './RewardCardLogic.types';

export function PointsPerVisitField({ showValidation, tierId }: PointsPerVisitFieldProps) {
  const { t } = useTranslation('cardEditor');
  // 2026-09-09 mixed refactor: earningMode is CARD-WIDE (top-level), read
  // from the store root instead of `tier.earningMode`.
  const earningMode = useCardBuilderStore((s) => s.earningMode);
  const tier = useCardBuilderStore((s) =>
    s.rewardTiers.find((tier) => tier.id === tierId),
  );
  const updateRewardTier = useCardBuilderStore((s) => s.updateRewardTier);

  if (!tier) return null;

  // Only shown for card-wide based_on_visits mode.
  if (earningMode !== 'based_on_visits') return null;

  const pointsPerVisit = tier.pointsPerVisit ?? null;
  const showError = showValidation && pointsPerVisit === null;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h4
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.reward.pointsPerVisit.title')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t('step6.reward.pointsPerVisit.helper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            id={`step6-tier-${tierId}-points-per-visit`}
            type="number"
            inputMode="numeric"
            value={pointsPerVisit ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                updateRewardTier(tierId, { pointsPerVisit: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num < 1) return; // store rejects < 1
              updateRewardTier(tierId, { pointsPerVisit: num });
            }}
            placeholder={t('step6.reward.pointsPerVisit.placeholder')}
            min={1}
            aria-label={t('step6.reward.pointsPerVisit.title')}
            aria-invalid={showError}
            className={`
              flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerVisit.unit')}
          </span>
        </div>

        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.reward.pointsPerVisit.requiredError')}
          </p>
        )}
      </div>
    </section>
  );
}
