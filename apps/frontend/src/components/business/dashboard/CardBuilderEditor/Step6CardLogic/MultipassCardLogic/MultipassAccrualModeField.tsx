/**
 * MultipassAccrualModeField — Step 6 section: Multipass card-wide 蓋章方式.
 *
 * Renders a three-option radio-group for selecting the multipass card
 * accrual mode (mirrors StampAccrualModeField pattern):
 *   per_stamp  (基於蓋章 / Manual Stamp)
 *   per_visit  (基於拜訪 / Per Visit)
 *   per_spend  (基於消費 / Per Spend)
 *
 * Differentiated PR-5 (2026-09-20): the corresponding per-tier threshold
 * inputs (perVisitCount / perSpendAmount etc.) live INSIDE each
 * MultipassTierRow, NOT here. See MultipassTierAccrualThresholdField.
 *
 * Why this card-wide mode + per-tier thresholds:
 *   - Stamp card has a single card-wide 蓋章方式 + a single card-wide
 *     threshold pair (stampsPerVisitCount / stampsPerSpendAmount in store
 *     頂層). Simple, but loses flexibility.
 *   - Multipass has N tiers; different merchants may want different
 *     rates per tier (e.g. tier-1 = 1 visit = 1 stamp, tier-2 = 1 visit
 *     = 2 stamps). User 2026-09-20: 「在大規則下每個 tier 有細微可控
 *     制的邏輯」 — so the **mode** stays card-wide (one operational model)
 *     but **thresholds** move inside each tier row.
 *
 * Visual pattern (Radio Card Pattern A — see apps/frontend/src/index.css §
 * Radio Card Pattern A): mirrored from StampAccrualModeField.
 *   - Native `<input type="radio">` is hidden behind an absolutely-
 *     positioned transparent overlay (`absolute opacity-0 size-5 cursor-pointer`).
 *   - Selected state is driven entirely by `:has(:checked)` rule on
 *     the `.radio-card-primary` class — no React conditional, no inline
 *     style.
 *
 * The store's `setMultipassAccrualMode` is called immediately on selection.
 * Switching modes does NOT clear per-tier threshold fields (UI hides
 * them; preserves user's data so switching back keeps the values).
 */

import { useTranslation } from 'react-i18next';
import { StampIcon, MapPinIcon, CurrencyIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MultipassAccrualModeFieldProps } from './MultipassCardLogic.types';

const MODE_ICONS = {
  per_stamp: StampIcon,
  per_visit: MapPinIcon,
  per_spend: CurrencyIcon,
} as const;

const MODE_ORDER = ['per_stamp', 'per_visit', 'per_spend'] as const;

export function MultipassAccrualModeField({
  showValidation: _showValidation,
}: MultipassAccrualModeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const multipassAccrualMode = useCardBuilderStore((s) => s.multipassAccrualMode);
  const setMultipassAccrualMode = useCardBuilderStore((s) => s.setMultipassAccrualMode);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.multipass.accrualModeTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.multipass.accrualModeDescription')}
        </p>
      </header>

      {/* Three stacked radio cards — Pattern A (primary fill, no inner dot).
          Mirrors StampAccrualModeField. The radio name is unique to multipass
          (step6-multipass-accrual-mode) so this stays isolated from the stamp
          card's radio group (step6-accrual-mode). */}
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={t('step6.multipass.accrualModeTitle')}
      >
        {MODE_ORDER.map((mode) => {
          const Icon = MODE_ICONS[mode];
          return (
            <label
              key={mode}
              htmlFor={`step6-multipass-accrual-${mode}`}
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
                id={`step6-multipass-accrual-${mode}`}
                type="radio"
                name="step6-multipass-accrual-mode"
                value={mode}
                checked={multipassAccrualMode === mode}
                onChange={() => setMultipassAccrualMode(mode)}
                className="absolute opacity-0 size-5 cursor-pointer top-4 left-4"
                aria-describedby={`step6-multipass-accrual-${mode}-helper`}
              />

              {/* Visual radio indicator — Pattern A. */}
              <span
                aria-hidden="true"
                className="
                  radio-card-fill mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  border-2 border-muted-foreground/40 bg-transparent
                  transition-colors duration-150
                "
              />

              {/* Icon + text */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className="radio-card-icon text-muted-foreground transition-colors duration-150"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t(`step6.multipass.modes.${mode}.label`)}
                  </span>
                </div>
                <p
                  id={`step6-multipass-accrual-${mode}-helper`}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t(`step6.multipass.modes.${mode}.helper`)}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
