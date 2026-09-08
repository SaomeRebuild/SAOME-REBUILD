/**
 * EarningModeField — Reward card sub-field 0 (點數累積方式).
 *
 * 2026-09-09 mixed refactor: `earningMode` is now CARD-WIDE (one mode per
 * card), moved OUT of each RewardTierRow and back to the top level of
 * `RewardCardLogic`. Mirrors `StampCardLogic`'s `<StampAccrualModeField />`
 * pattern exactly (3-option radio group at top level).
 *
 * Reads top-level `earningMode` from store and writes via `setEarningMode`.
 * Switching mode ALSO clears all per-tier earn rate fields
 * (pointsPerVisit / pointsPerSpendAmount / pointsPerSpendPoints) — handled
 * by `setEarningMode` in the store, so no client-side clearing here.
 *
 * Renders a three-option radio-group:
 *   based_on_points   (基於點數 — 自訂條件手動核發)
 *   based_on_visits   (基於拜訪 — 每次到訪自動加點)
 *   based_on_spending (基於消費 — 每消費一定金額自動加點)
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
 * Mirrors StampAccrualModeField's pattern but uses different icons (Coin / MapPin / Wallet).
 */

import { useTranslation } from 'react-i18next';
import { CoinsIcon, MapPinIcon, WalletIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { EarningModeFieldProps } from './RewardCardLogic.types';

const MODE_ICONS = {
  based_on_points: CoinsIcon,
  based_on_visits: MapPinIcon,
  based_on_spending: WalletIcon,
} as const;

const MODE_ORDER = ['based_on_points', 'based_on_visits', 'based_on_spending'] as const;

export function EarningModeField({ showValidation: _showValidation }: EarningModeFieldProps) {
  const { t } = useTranslation('cardEditor');
  const earningMode = useCardBuilderStore((s) => s.earningMode);
  const setEarningMode = useCardBuilderStore((s) => s.setEarningMode);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.reward.earningModeTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.reward.earningModeDescription')}
        </p>
      </header>

      {/* Three stacked radio cards — Pattern A (primary fill, no inner dot).
          Selected visuals driven by `.radio-card-primary :has(:checked)` rule
          in index.css — single source of truth, no inline style. */}
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={t('step6.reward.earningModeTitle')}
      >
        {MODE_ORDER.map((mode) => {
          const Icon = MODE_ICONS[mode];
          return (
            <label
              key={mode}
              htmlFor={`step6-reward-earning-${mode}`}
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
                id={`step6-reward-earning-${mode}`}
                type="radio"
                name="step6-reward-earning-mode"
                value={mode}
                checked={earningMode === mode}
                onChange={() => setEarningMode(mode)}
                className="absolute opacity-0 size-5 cursor-pointer top-4 left-4"
                aria-describedby={`step6-reward-earning-${mode}-helper`}
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
                    {t(`step6.reward.modes.${mode}.label`)}
                  </span>
                </div>
                <p
                  id={`step6-reward-earning-${mode}-helper`}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t(`step6.reward.modes.${mode}.helper`)}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}