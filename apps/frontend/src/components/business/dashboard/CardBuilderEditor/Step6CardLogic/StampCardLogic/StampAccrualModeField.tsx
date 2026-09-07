/**
 * StampAccrualModeField — Step 6 section 1.
 *
 * Renders a three-option radio-group for selecting the stamp accrual mode:
 *   per_stamp  (手動蓋章)
 *   per_visit  (來訪自動)
 *   per_spend  (消費自動)
 *
 * Visual pattern (Radio Card Pattern A — single source of truth :has(:checked))
 * (see apps/frontend/src/index.css § Radio Card Pattern A):
 *
 *   - Native `<input type="radio">` is hidden behind an absolutely-positioned
 *     transparent overlay (`absolute opacity-0 size-5 cursor-pointer`) that
 *     captures clicks across the whole label.
 *   - **Selected state** is driven entirely by the `:has(:checked)` CSS rule
 *     on the `.radio-card-primary` class — no React conditional, no inline
 *     style. The indicator span flips fill via the `.radio-card-fill` class,
 *     the icon via `.radio-card-icon`.
 *
 * Why we don't use Tailwind's `has-[:checked]:bg-primary` (2026-09-07):
 *   Tailwind v4 only emits `bg-primary` / `border-primary` color utilities
 *   when the semantic token is declared inside `@theme {}`. Our `--color-primary`
 *   lives in `:root, [data-theme='dark']` + `[data-theme='light']` blocks (so
 *   dark/light can override per-mode), so `bg-primary` / `border-primary` are
 *   NOT in the built CSS. We use hand-written `:has(:checked)` rules on
 *   `.radio-card-primary` instead — single source of truth, no inline style,
 *   no React conditionals.
 *
 * The store's `setStampAccrualMode` is called immediately on selection.
 */

import { useTranslation } from 'react-i18next';
import { StampIcon, MapPinIcon, CurrencyIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { StampAccrualModeFieldProps } from './StampCardLogic.types';

const MODE_ICONS = {
  per_stamp: StampIcon,
  per_visit: MapPinIcon,
  per_spend: CurrencyIcon,
} as const;

const MODE_ORDER = ['per_stamp', 'per_visit', 'per_spend'] as const;

export function StampAccrualModeField({ showValidation: _showValidation }: StampAccrualModeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const stampAccrualMode = useCardBuilderStore((s) => s.stampAccrualMode);
  const setStampAccrualMode = useCardBuilderStore((s) => s.setStampAccrualMode);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.accrualModeTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.stamp.accrualModeDescription')}
        </p>
      </header>

      {/* Three stacked radio cards — Pattern A (primary fill, no inner dot).
          Selected visuals driven by `.radio-card-primary :has(:checked)` rule
          in index.css — single source of truth, no inline style. */}
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={t('step6.stamp.accrualModeTitle')}
      >
        {MODE_ORDER.map((mode) => {
          const Icon = MODE_ICONS[mode];
          return (
            <label
              key={mode}
              htmlFor={`step6-accrual-${mode}`}
              className="
                radio-card-primary group relative flex items-start gap-3 rounded-lg
                border border-border bg-card p-4
                transition-all duration-150
                hover:scale-[1.01]
                active:scale-[0.99]
                focus-within:outline-2 focus-within:outline-offset-2
                focus-within:outline-[var(--color-ring)]
              "
            >
              {/* Hidden native radio — absolutely-positioned overlay captures clicks across the whole label */}
              <input
                id={`step6-accrual-${mode}`}
                type="radio"
                name="step6-accrual-mode"
                value={mode}
                checked={stampAccrualMode === mode}
                onChange={() => setStampAccrualMode(mode)}
                className="absolute opacity-0 size-5 cursor-pointer top-4 left-4"
                aria-describedby={`step6-accrual-${mode}-helper`}
              />

              {/* Visual radio indicator — Pattern A: fills with SAOME 橘色 on selection
                  via `.radio-card-primary:has(:checked) .radio-card-fill` in index.css. */}
              <span
                aria-hidden="true"
                className="
                  radio-card-fill mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  border-2 border-muted-foreground/40 bg-transparent
                  transition-colors duration-150
                "
              />

              {/* Icon + text — icon flips to text-primary via `.radio-card-icon` rule. */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className="radio-card-icon text-muted-foreground transition-colors duration-150"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t(`step6.stamp.modes.${mode}.label`)}
                  </span>
                </div>
                <p
                  id={`step6-accrual-${mode}-helper`}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t(`step6.stamp.modes.${mode}.helper`)}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
