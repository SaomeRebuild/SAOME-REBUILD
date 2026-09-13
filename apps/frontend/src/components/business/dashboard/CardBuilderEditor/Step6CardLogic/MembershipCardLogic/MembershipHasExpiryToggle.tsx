/**
 * MembershipHasExpiryToggle — Card-wide "無期限 / 有期限" Switch.
 *
 * Renders a Switch component controlled by `store.hasExpiry`. Toggling to
 * false ALSO clears all per-tier `durationType` (handled by `setHasExpiry`
 * setter, mirrors `setEarningMode` pattern).
 *
 * Copy varies by `isPaid` (2026-09-14):
 *   - paid card (isPaid=true)  → "有期限（月/年付費）" / "無期限（終身會員）"
 *   - free card (isPaid=false) → "有期限（指定到期日）" / "無期限（終身會員）"
 *   The OFF label is shared (lifetime applies to both contexts).
 *
 * When `isPaid === false` the parent dispatcher renders the free state
 * with this toggle inside it (MembershipCardLogicFreeState, 2026-09-14).
 * Previously, the free state rendered no toggle at all — but the user
 * needs the toggle for the free card's expiry configuration
 * (custom_days / specific_date).
 */

import { useTranslation } from 'react-i18next';
import { InfinityIcon, CalendarClockIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MembershipHasExpiryToggleProps } from './MembershipCardLogic.types';

export function MembershipHasExpiryToggle({
  showValidation: _showValidation,
}: MembershipHasExpiryToggleProps) {
  const { t } = useTranslation('cardEditor');
  const hasExpiry = useCardBuilderStore((s) => s.hasExpiry);
  const setHasExpiry = useCardBuilderStore((s) => s.setHasExpiry);
  const isPaid = useCardBuilderStore((s) => s.isPaid);

  // 2026-09-14: 切換 copy 依 isPaid 決定。
  //   - paid card  → hasExpiryOn (月/年付費語意)
  //   - free card  → hasExpiryOnFree (指定到期日語意)
  // OFF 兩邊共用 hasExpiryOff（終身會員）。
  const labelOn = isPaid
    ? t('step6.membership.hasExpiryOn')
    : t('step6.membership.hasExpiryOnFree');

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {hasExpiry ? (
            <CalendarClockIcon size={16} aria-hidden="true" className="text-primary" />
          ) : (
            <InfinityIcon size={16} aria-hidden="true" className="text-primary" />
          )}
          {t('step6.membership.hasExpiryToggle')}
        </h3>
      </header>

      {/* Toggle: ON = hasExpiry=true (with expiry), OFF = hasExpiry=false (lifetime).
          Native <button role="switch"> avoids adding @radix-ui/react-switch
          dependency for a single toggle — semantic match for the WAI-ARIA
          switch pattern (a11y test passes via aria-checked).

          2026-09-13 fix: ON state now uses `bg-primary text-on-primary` so
          the button is clearly distinguishable from the OFF state (which
          remains `bg-card text-foreground`). The thumb track + thumb knob
          have been removed in favor of a single background-color swap —
          simpler and visually unambiguous.

          2026-09-14: ON state copy varies by isPaid (see labelOn above). */}
      <button
        type="button"
        role="switch"
        aria-checked={hasExpiry}
        onClick={() => setHasExpiry(!hasExpiry)}
        className={`
          inline-flex w-fit items-center gap-3 rounded-lg border px-4 py-3
          text-sm font-medium
          transition-all duration-150
          hover:scale-[1.01]
          active:scale-[0.99]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${hasExpiry
            ? 'border-primary bg-primary text-on-primary'
            : 'border-border bg-card text-foreground'
          }
        `}
      >
        <span>
          {hasExpiry
            ? labelOn
            : t('step6.membership.hasExpiryOff')}
        </span>
      </button>
    </section>
  );
}