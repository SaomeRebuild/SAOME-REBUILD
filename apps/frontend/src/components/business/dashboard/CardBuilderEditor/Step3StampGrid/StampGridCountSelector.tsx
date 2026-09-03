/**
 * StampGridCountSelector — 4-button segmented control for picking the
 * number of rows in the stamp grid (1×5, 2×5, 3×5, or 4×5).
 *
 * Each button is a real `<button>` (keyboard accessible), with the active
 * option styled via `data-state="checked"` + `bg-primary text-primary-foreground`.
 *
 * Motion (2026-09-04 update — design-system § 6):
 *   - Inactive buttons get `hover:bg-muted` (was only `hover:text-foreground`,
 *     too subtle — users reported "no click feel").
 *   - All buttons get `active:scale-95` for press feedback, with a
 *     `transition-all` so the scale-down is smooth.
 *   - Active buttons get `hover:bg-primary/90` so the hover state is
 *     visibly distinct from the resting active state.
 *
 * Touch target (2026-09-04 update — Rule 013 RWD):
 *   - All buttons have `min-h-[44px]` to meet the mobile 44pt touch target
 *     threshold. Without this, segmented controls feel cramped on phones.
 *
 * Accessibility (2026-09-04 update):
 *   - Removed `aria-pressed` (radio + toggle pattern is conflicting).
 *     `role="radio"` + `aria-checked` is the correct single-select
 *     semantic; `data-state="checked"` provides the same hook for tests
 *     and CSS without the aria conflict.
 *
 * The label format is locale-aware: `'{{rows}} 列'` in zh-TW
 * (see cardEditor.zh-TW.ts step3.stampSection.gridCount.rows).
 */
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { StampGridRows } from '@/components/business/stampCard/StampGridPreview';

const ROW_OPTIONS: readonly StampGridRows[] = [1, 2, 3, 4];

export function StampGridCountSelector() {
  const { t } = useTranslation('cardEditor');
  const rows = useCardBuilderStore((s) => s.stampGridRows);
  const setRows = useCardBuilderStore((s) => s.setStampGridRows);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {t('step3.stampSection.gridCount.label')}
      </span>
      <div
        role="radiogroup"
        aria-label={t('step3.stampSection.gridCount.label')}
        className="inline-flex w-full max-w-sm rounded-md border border-input bg-background p-1"
      >
        {ROW_OPTIONS.map((option) => {
          const isActive = rows === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-state={isActive ? 'checked' : undefined}
              onClick={() => setRows(option)}
              className={
                'flex-1 rounded-sm px-2 py-2 text-sm ' +
                'min-h-[44px] ' +
                'transition-all duration-[var(--transition-fast)] ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                (isActive
                  ? 'bg-primary text-primary-foreground shadow-sm ' +
                    'hover:bg-primary/90 active:bg-primary/90 active:scale-95 '
                  : 'text-muted-foreground ' +
                    'hover:bg-muted hover:text-foreground ' +
                    'active:bg-muted active:text-foreground active:scale-95 ')
              }
            >
              {t('step3.stampSection.gridCount.rows', { rows: option })}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('step3.stampSection.gridCount.cells', {
          count: rows * 5,
        })}
      </p>
    </div>
  );
}
