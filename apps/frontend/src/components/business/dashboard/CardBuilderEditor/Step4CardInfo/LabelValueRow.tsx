/**
 * LabelValueRow — single editable row inside a Label+Value list (Step 4).
 *
 * Renders a Label input, a Value input (or textarea when `valueMultiline`
 * is true), and a remove button. Pure presentational; state is owned by
 * the parent. Shows a destructive border on the value field when
 * `showValidation && !validateValue(value)`.
 *
 * RWD (Rule 013 + 014):
 *   - `< 768px` (default): stacked 1 column (label above value)
 *   - `≥ 768px` (`md:`): side-by-side 2 columns
 *
 * Auto-grow textarea (2026-09-05): when `valueMultiline` is true, the
 * value renders as a `<textarea rows={1}>` whose height tracks
 * `scrollHeight`. We reset `style.height` to `'auto'` before measuring so
 * deleting lines shrinks the box instead of leaving stale overflow.
 */

import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash } from 'lucide-react';
import type { LabelValueRowProps } from './Step4CardInfo.types';

export function LabelValueRow({
  idx,
  label,
  value,
  labelPlaceholderKey,
  valuePlaceholderKey,
  valueErrorKey,
  showValidation,
  removeLabelKey,
  valueMultiline = false,
  onLabelChange,
  onValueChange,
  onRemove,
}: LabelValueRowProps) {
  const { t } = useTranslation('cardEditor');
  const labelId = `step4-row-${idx}-label`;
  const valueId = `step4-row-${idx}-value`;
  const labelPlaceholder = t(labelPlaceholderKey);
  const valuePlaceholder = t(valuePlaceholderKey);
  const removeLabel = t(removeLabelKey);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea height to match its content. Runs synchronously
  // before paint so we don't see a one-frame jitter when typing.
  useLayoutEffect(() => {
    if (!valueMultiline) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    // +2 accounts for the 1px top + 1px bottom border so the cursor sits
    // visually inside the rounded border without clipping.
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }, [value, valueMultiline]);

  // Shared border classes — applied to both <input> and <textarea> variants.
  const errorBorder = showValidation && valueErrorKey ? 'border-destructive focus-visible:ring-destructive' : 'border-input';
  const valueBaseInput =
    `flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errorBorder}`;

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border/50 pt-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={labelId} className="text-xs font-medium text-muted-foreground md:sr-only">
          {t('step4.backFields.labelLabel')}
        </label>
        <input
          id={labelId}
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={labelPlaceholder}
          autoComplete="off"
          maxLength={40}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={valueId} className="text-xs font-medium text-muted-foreground md:sr-only">
          {t('step4.backFields.valueLabel')}
        </label>
        {valueMultiline ? (
          <textarea
            ref={textareaRef}
            id={valueId}
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={valuePlaceholder}
            autoComplete="off"
            maxLength={2048}
            rows={1}
            aria-invalid={showValidation && valueErrorKey ? 'true' : undefined}
            className={`flex min-h-10 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errorBorder}`}
          />
        ) : (
          <input
            id={valueId}
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={valuePlaceholder}
            autoComplete="off"
            maxLength={2048}
            aria-invalid={showValidation && valueErrorKey ? 'true' : undefined}
            className={valueBaseInput}
          />
        )}
        {showValidation && valueErrorKey && (
          <p
            className="text-xs"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            {t(valueErrorKey)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="
          inline-flex h-10 w-10 items-center justify-center self-start rounded-md border border-input bg-background
          text-muted-foreground transition-all duration-150
          hover:scale-[1.02] hover:border-destructive hover:text-destructive
          active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          md:self-center
        "
      >
        <Trash size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
