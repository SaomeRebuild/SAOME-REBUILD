/**
 * AccrualThresholdField — Step 6 section 2b (門檻設定).
 *
 * Conditionally renders based on `stampAccrualMode`:
 *   - `null` / `per_stamp`: nothing shown (manual mode, no threshold needed)
 *   - `per_visit`: two inputs for "N 次拜訪 = M 個蓋章"
 *     (stampsPerVisitCount = N, stampsPerVisitStamps = M)
 *   - `per_spend`: two inputs for "N 元消費 = M 個蓋章"
 *     (stampsPerSpendAmount = N, stampsPerSpendStamps = M)
 *
 * Behavior:
 *   - All setters reject ≤ 0 (or ≤ 0 for spend amount).
 *   - `null` is accepted — means "not set yet".
 *   - Validation errors surface when `showValidation=true` AND the required
 *     pair (count + stamps) are both null for the active mode.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { AccrualThresholdFieldProps } from './StampCardLogic.types';

export function AccrualThresholdField({ showValidation }: AccrualThresholdFieldProps) {
  const { t } = useTranslation('cardEditor');
  const stampAccrualMode = useCardBuilderStore((s) => s.stampAccrualMode);
  const stampsPerVisitCount = useCardBuilderStore((s) => s.stampsPerVisitCount);
  const stampsPerVisitStamps = useCardBuilderStore((s) => s.stampsPerVisitStamps);
  const stampsPerSpendAmount = useCardBuilderStore((s) => s.stampsPerSpendAmount);
  const stampsPerSpendStamps = useCardBuilderStore((s) => s.stampsPerSpendStamps);
  const setStampsPerVisitCount = useCardBuilderStore((s) => s.setStampsPerVisitCount);
  const setStampsPerVisitStamps = useCardBuilderStore((s) => s.setStampsPerVisitStamps);
  const setStampsPerSpendAmount = useCardBuilderStore((s) => s.setStampsPerSpendAmount);
  const setStampsPerSpendStamps = useCardBuilderStore((s) => s.setStampsPerSpendStamps);

  // Only shown for per_visit and per_spend modes.
  if (stampAccrualMode === null || stampAccrualMode === 'per_stamp') {
    return null;
  }

  if (stampAccrualMode === 'per_visit') {
    const showError =
      showValidation && (stampsPerVisitCount === null || stampsPerVisitStamps === null);
    return (
      <section className="flex min-w-0 flex-col gap-2">
        <header className="flex flex-col gap-1">
          <h3
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('step6.stamp.accrualThreshold.perVisitTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('step6.stamp.accrualThreshold.perVisitHelper')}
          </p>
        </header>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              id="step6-stamps-per-visit-count"
              type="number"
              inputMode="numeric"
              value={stampsPerVisitCount ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') { setStampsPerVisitCount(null); return; }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return;
                setStampsPerVisitCount(Math.round(num));
              }}
              placeholder="1"
              min={1}
              aria-label={t('step6.stamp.accrualThreshold.perVisitVisitsLabel')}
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
              {t('step6.stamp.accrualThreshold.perVisitVisitsLabel')}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">=</span>
            <input
              id="step6-stamps-per-visit-stamps"
              type="number"
              inputMode="numeric"
              value={stampsPerVisitStamps ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') { setStampsPerVisitStamps(null); return; }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) return;
                setStampsPerVisitStamps(Math.round(num));
              }}
              placeholder="1"
              min={1}
              aria-label={t('step6.stamp.accrualThreshold.perVisitStampsLabel')}
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
              {t('step6.stamp.accrualThreshold.perVisitStampsLabel')}
            </span>
          </div>

          {showError && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.stamp.accrualThreshold.requiredError')}
            </p>
          )}
        </div>
      </section>
    );
  }

  // per_spend
  const showError =
    showValidation && (stampsPerSpendAmount === null || stampsPerSpendStamps === null);
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.accrualThreshold.perSpendTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.stamp.accrualThreshold.perSpendHelper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            id="step6-stamps-per-spend-amount"
            type="number"
            inputMode="decimal"
            value={stampsPerSpendAmount ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') { setStampsPerSpendAmount(null); return; }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num <= 0) return;
              setStampsPerSpendAmount(num);
            }}
            placeholder="100"
            min={0.01}
            aria-label={t('step6.stamp.accrualThreshold.perSpendAmountLabel')}
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
            {t('step6.stamp.accrualThreshold.perSpendAmountLabel')}
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">=</span>
          <input
            id="step6-stamps-per-spend-stamps"
            type="number"
            inputMode="numeric"
            value={stampsPerSpendStamps ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') { setStampsPerSpendStamps(null); return; }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num <= 0) return;
              setStampsPerSpendStamps(Math.round(num));
            }}
            placeholder="1"
            min={1}
            aria-label={t('step6.stamp.accrualThreshold.perSpendStampsLabel')}
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
            {t('step6.stamp.accrualThreshold.perSpendStampsLabel')}
          </span>
        </div>

        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.stamp.accrualThreshold.requiredError')}
          </p>
        )}
      </div>
    </section>
  );
}
