/**
 * MultipassTierAccrualThresholdField — Per-tier 門檻輸入框 (2026-09-20 PR-5).
 *
 * Renders the per-tier accrual threshold pair for a SINGLE multipass tier.
 * Conditionally rendered based on the CARD-WIDE `multipassAccrualMode`:
 *   - `null` / `per_stamp`: nothing shown (no threshold needed)
 *   - `per_visit`: two inputs for "N 次拜訪 = M 個蓋章"
 *     (tier.perVisitCount = N, tier.perVisitStamps = M)
 *   - `per_spend`: two inputs for "消費 N 元 (或 R[N],currency-aware) = M 個蓋章"
 *     (tier.perSpendAmount = N, tier.perSpendStamps = M)
 *
 * Differs from StampCardLogic.AccrualThresholdField (its card-wide sibling):
 *   - That component reads store's card-wide stampsPerVisitCount / stampsPerSpendAmount.
 *   - THIS component reads the tier's perVisitCount / perSpendAmount fields
 *     via `updateMultipassTier(id, { perVisitCount: N })`. Per-tier input;
 *     each tier row in MultipassTierList renders its own.
 *
 * Behavior:
 *   - Store setters reject ≤ 0 (or ≤ 0.01 for spend amount).
 *   - `null` is accepted — means "not set yet".
 *   - Validation errors surface when `showValidation=true` AND the required
 *     pair (count + stamps for per_visit, or amount + stamps for per_spend)
 *     are both null for the active mode.
 *
 * Currency-aware per-spend amount label (2026-09-10 stamp pattern, mirrored):
 *   - TWD (zh-TW): suffix 元消費
 *   - TWD (en): suffix NT$ (placeholder)
 *   - ZAR: prefix R with no suffix (verb complement 消費 is dropped because
 *     in ZAR locale the prefix-R syntax makes it redundant).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MultipassTierAccrualThresholdFieldProps } from './MultipassCardLogic.types';

export function MultipassTierAccrualThresholdField({
  showValidation,
  tierId,
}: MultipassTierAccrualThresholdFieldProps) {
  const { t } = useTranslation('cardEditor');
  // Card-wide mode drives whether we render anything (and which pair).
  const multipassAccrualMode = useCardBuilderStore((s) => s.multipassAccrualMode);
  // Currency controls the prefix/suffix placement of the per-spend amount unit.
  const currency = useCardBuilderStore((s) => s.currency);

  // Tier-local values: read the tier that matches `tierId`, then access
  // the 4 per-tier threshold fields. updateMultipassTier accepts a partial
  // patch so we only touch one field per setter call.
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((t) => t.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);

  if (!tier) return null;

  // Only render for per_visit / per_spend modes.
  if (multipassAccrualMode === null || multipassAccrualMode === 'per_stamp') {
    return null;
  }

  if (multipassAccrualMode === 'per_visit') {
    const perVisitCount = tier.perVisitCount;
    const perVisitStamps = tier.perVisitStamps;
    const showError =
      showValidation && (perVisitCount === null || perVisitStamps === null);

    return (
      <section className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-col gap-1">
          <h4
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('step6.multipass.tier.perVisitTitle')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('step6.multipass.tier.perVisitHelper')}
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              id={`step6-multipass-${tierId}-per-visit-count`}
              type="number"
              inputMode="numeric"
              value={perVisitCount ?? ''}
              min={1}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  updateMultipassTier(tierId, { perVisitCount: null });
                  return;
                }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return;
                updateMultipassTier(tierId, { perVisitCount: Math.round(num) });
              }}
              placeholder="1"
              aria-label={t('step6.multipass.tier.perVisitVisitsLabel')}
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
              {t('step6.multipass.tier.perVisitVisitsLabel')}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">=</span>
            <input
              id={`step6-multipass-${tierId}-per-visit-stamps`}
              type="number"
              inputMode="numeric"
              value={perVisitStamps ?? ''}
              min={1}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  updateMultipassTier(tierId, { perVisitStamps: null });
                  return;
                }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return;
                updateMultipassTier(tierId, { perVisitStamps: Math.round(num) });
              }}
              placeholder="1"
              aria-label={t('step6.multipass.tier.perVisitStampsLabel')}
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
              {t('step6.multipass.tier.perVisitStampsLabel')}
            </span>
          </div>

          {showError && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.multipass.tier.accrualThresholdRequiredError')}
            </p>
          )}
        </div>
      </section>
    );
  }

  // per_spend
  const perSpendAmount = tier.perSpendAmount;
  const perSpendStamps = tier.perSpendStamps;
  const showError =
    showValidation && (perSpendAmount === null || perSpendStamps === null);

  // currency-aware unit label: TWD uses suffix 元消費; ZAR uses prefix R.
  const isZAR = currency === 'ZAR';
  const perSpendAmountText = isZAR
    ? t('step6.multipass.tier.perSpendAmountLabelZAR')
    : t('step6.multipass.tier.perSpendAmountLabelTWD');

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h4
          className="text-sm font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.multipass.tier.perSpendTitle')}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t('step6.multipass.tier.perSpendHelper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {isZAR && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {perSpendAmountText}
            </span>
          )}
          <input
            id={`step6-multipass-${tierId}-per-spend-amount`}
            type="number"
            inputMode="decimal"
            value={perSpendAmount ?? ''}
            min={0.01}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                updateMultipassTier(tierId, { perSpendAmount: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num <= 0) return;
              updateMultipassTier(tierId, { perSpendAmount: num });
            }}
            placeholder="100"
            aria-label={perSpendAmountText}
            aria-invalid={showError}
            className={`
              flex h-10 w-full min-w-0 rounded-md border bg-background py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${isZAR ? 'pl-12 pr-3' : 'pl-3 pr-12'}
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          {!isZAR && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {perSpendAmountText}
            </span>
          )}
          <span className="shrink-0 text-sm text-muted-foreground">=</span>
          <input
            id={`step6-multipass-${tierId}-per-spend-stamps`}
            type="number"
            inputMode="numeric"
            value={perSpendStamps ?? ''}
            min={1}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                updateMultipassTier(tierId, { perSpendStamps: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num <= 0) return;
              updateMultipassTier(tierId, { perSpendStamps: Math.round(num) });
            }}
            placeholder="1"
            aria-label={t('step6.multipass.tier.perSpendStampsLabel')}
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
            {t('step6.multipass.tier.perSpendStampsLabel')}
          </span>
        </div>

        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.multipass.tier.accrualThresholdRequiredError')}
          </p>
        )}
      </div>
    </section>
  );
}
