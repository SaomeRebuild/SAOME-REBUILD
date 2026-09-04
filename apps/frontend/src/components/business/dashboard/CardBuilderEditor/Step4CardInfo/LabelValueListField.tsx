/**
 * LabelValueListField — generic wrapper for the two Step 4 lists (Back fields
 * and Links). Renders the section title + hint, the rows, the add button,
 * and a counter hint. Pure presentational; all state lives in the parent.
 *
 * RWD: 4-grid padding per Rule 014; rows stack vertically on mobile.
 */

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { LabelValueRow } from './LabelValueRow';
import type { LabelValueListFieldProps } from './Step4CardInfo.types';

export function LabelValueListField({
  titleKey,
  hintKey,
  addLabelKey,
  counterKey,
  maxReachedKey,
  rows,
  max,
  onLabelChange,
  onValueChange,
  onAdd,
  onRemove,
  validateValue,
  valueErrorKey,
  labelPlaceholderKey,
  valuePlaceholderKey,
  removeLabelKey,
  showValidation,
  valueMultiline = false,
}: LabelValueListFieldProps) {
  const { t } = useTranslation('cardEditor');
  const atMax = rows.length >= max;
  const counterText = t(counterKey, { count: rows.length });

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-6">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t(titleKey)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(hintKey)}</p>
      </header>

      {/* 列表 */}
      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
            {t(maxReachedKey /* placeholder when empty */)}
          </p>
        ) : (
          rows.map((row, idx) => (
            <LabelValueRow
              key={idx}
              idx={idx}
              label={row.label}
              value={row.value}
              labelPlaceholderKey={labelPlaceholderKey}
              valuePlaceholderKey={valuePlaceholderKey}
              valueErrorKey={showValidation && !validateValue(row.value) ? valueErrorKey : undefined}
              showValidation={showValidation}
              removeLabelKey={removeLabelKey}
              valueMultiline={valueMultiline}
              onLabelChange={(next) => onLabelChange(idx, next)}
              onValueChange={(next) => onValueChange(idx, next)}
              onRemove={() => onRemove(idx)}
            />
          ))
        )}
      </div>

      {/* 新增按鈕 + counter hint */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{counterText}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={atMax}
          className="
            inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2
            text-sm font-medium text-foreground
            transition-all duration-150
            hover:scale-[1.02] hover:border-primary hover:text-primary
            active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:border-input disabled:hover:text-foreground
          "
        >
          <Plus size={16} aria-hidden="true" />
          {t(addLabelKey)}
        </button>
      </div>
      {atMax && (
        <p className="text-xs text-muted-foreground">{t(maxReachedKey)}</p>
      )}
    </section>
  );
}