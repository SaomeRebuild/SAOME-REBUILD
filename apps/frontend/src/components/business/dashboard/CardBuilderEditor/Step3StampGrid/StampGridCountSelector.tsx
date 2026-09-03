/**
 * StampGridCountSelector — 4-button segmented control for picking the
 * number of rows in the stamp grid (1×5, 2×5, 3×5, or 4×5).
 *
 * Each button is a real `<button>` (keyboard accessible), with the active
 * option styled via `aria-pressed="true"` + `bg-primary text-primary-foreground`.
 * The icons are inline SVG so we don't pull lucide-react for trivial shapes.
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
              aria-pressed={isActive}
              onClick={() => setRows(option)}
              className={
                'flex-1 rounded-sm px-2 py-1.5 text-sm transition-colors ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                (isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground')
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
