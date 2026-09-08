/**
 * PointsPerSpendField — Reward tier sub-field 0c (基於消費門檻).
 *
 * 2026-09-09 mixed refactor: this field stays INSIDE each RewardTierRow,
 * but is now CONDITIONAL on the CARD-WIDE `earningMode` (top-level)
 * instead of `tier.earningMode`. Read/write goes through
 * `updateRewardTier(tierId, { pointsPerSpendAmount })` and
 * `updateRewardTier(tierId, { pointsPerSpendPoints })`.
 *
 * 2026-09-09 desktop layout: the two inputs ("每消費 [N] 元" and
 * "= 獲得 [M] 個點數") are rendered as a SINGLE horizontal sentence on md+.
 * Mobile stays as TWO semantic phrase rows (one per phrase) so labels
 * don't break every fragment onto its own line.
 *
 * 2026-09-09 2nd-pass mobile polish: previous fix used `w-full md:w-24`
 * for amount input and `w-full md:w-20` for points input — which forced
 * mobile inputs to claim full container width, pushing labels and units
 * onto separate lines. The user asked us to compact the inputs so the
 * whole phrase fits on one line:
 *   Mobile:
 *     每消費 [200] 元
 *     =獲得 [2] 個點數       (no pl-4 indent — both rows start at left margin)
 *   Desktop (md+):
 *     每消費 [200] 元 =獲得 [2] 個點數    (single horizontal sentence)
 *
 *   equalLabel + earnLabel were merged into `equalEarnLabel` ('=獲得') so
 *   there's no visible space between "=" and the verb (previous gap-x-1.5
 *   between two separate spans produced "= 獲得").
 *
 * Layout strategy:
 *   - Outer container: flex-col on mobile (2 stacked phrase rows, 8px gap),
 *     md:flex-row on md+ (single horizontal sentence).
 *   - Each phrase-row is its own flex container with `gap-x-1.5 gap-y-1`
 *     and `md:contents` so the children get hoisted into the outer container
 *     at md+ screens (display: contents visually flattens the DOM).
 *   - Row 1: "每消費 [N] 元"        (phrase 1 — spend amount)
 *   - Row 2: "=獲得 [M] 個點數"     (phrase 2 — earned points)
 *
 * Input widths (2026-09-09 2nd-pass): amount input = w-24 (96px), points
 * input = w-20 (80px). Both widths apply on BOTH mobile and desktop —
 * removing the `w-full` mobile fallback that was forcing inputs to claim
 * the full container width. Both inputs use `min-w-0` so labels stay
 * readable even in narrow md viewports.
 *
 * 2026-09-09 currency placement fix: ZAR uses prefix notation (R first,
 * amount after) per South African Rand convention. TWD keeps suffix
 * (元 after) per zh-TW convention. The phrase renders as:
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

      {/* 2026-09-09 mobile-fix layout: the sentence is split into TWO semantic
          phrase-row containers (one for "每消費 [N] 元", one for
          "=獲得 [M] 個點數"). On mobile each row renders as its own phrase
          so labels and inputs stay together visually. On md+ the rows use
          `md:contents` (display: contents) so their children get hoisted
          into the outer container — visually the sentence still reads as
          one continuous horizontal sentence.

          2026-09-09 2nd-pass mobile polish: each input uses a FIXED
          width (w-24 / w-20) on BOTH mobile and desktop — the previous
          `w-full md:w-24` mobile fallback forced inputs to claim the
          full container width on mobile, pushing labels and units onto
          separate lines. With fixed mobile widths, the whole phrase
          fits on one line: "每消費 [input] 元" / "=獲得 [input] 個點數". */}

      {/* Outer container — mobile = vertical (2 stacked rows, 8px gap),
          md+ = horizontal single-row with wrap (for very narrow md viewports). */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap md:gap-x-2 md:gap-y-1.5">
        {/* Phrase row 1: "每消費 [N] 元" (spend amount).
            Mobile input width: w-24 (96px). Labels + input + unit all fit
            on one line at ≥320px viewport. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 md:contents">
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
              flex h-10 min-w-0 rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${showError ? 'border-destructive' : 'border-input'}
              w-24
            `}
          />
          {amountUnitSuffix && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {amountUnitSuffix}
            </span>
          )}
        </div>

        {/* Phrase row 2: "=獲得 [M] 個點數" (earned points).
            2026-09-09 2nd-pass: equalLabel + earnLabel merged into a
            single `equalEarnLabel` span so the sentence renders as
            "=獲得" with no visible space between "=" and the verb.
            Mobile indent (pl-4) removed in 2nd-pass — both rows now
            start at the left margin and each fits on one line. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 md:contents">
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerSpend.equalEarnLabel')}
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
              flex h-10 min-w-0 rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${showError ? 'border-destructive' : 'border-input'}
              w-20
            `}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.reward.pointsPerSpend.pointsLabel')}
          </span>
        </div>
      </div>

      {showError && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.reward.pointsPerSpend.requiredError')}
        </p>
      )}
    </section>
  );
}
