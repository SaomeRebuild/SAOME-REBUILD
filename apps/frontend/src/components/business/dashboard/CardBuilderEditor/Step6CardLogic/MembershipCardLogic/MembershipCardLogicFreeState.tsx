/**
 * MembershipCardLogicFreeState — Full editor for 免費會員卡 (2026-09-14).
 *
 * Renders when `cardType === 'membership_card' && isPaid === false`.
 * Previously a placeholder "免費會員卡無需付費設定" empty state — now a
 * full editor that lets the tenant configure a free membership card:
 *
 *   1. Membership tier name (single input, bound to `membershipTiers[0].name`)
 *      — reuses `MembershipTierNameField` for consistent UX with paid card.
 *      The preview auto-updates because `PassCardPreviewBody.firstMembershipTierName`
 *      reads from `membershipTiers[0].name`.
 *
 *   2. Card-level hasExpiry toggle (reuses `MembershipHasExpiryToggle`)
 *      — the toggle text switches based on `isPaid` (free card uses
 *      "有期限（指定到期日）" instead of "有期限（月/年付費）").
 *
 *   3. Expiry mode + custom-days / specific-date inputs
 *      (only shown when hasExpiry=true).
 *      - `MembershipExpiryModeField` — radio for custom_days / specific_date
 *      - `MembershipCustomExpiryDaysField` — shown when mode='custom_days'
 *      - `MembershipSpecificExpiryDateField` — shown when mode='specific_date'
 *
 *   4. Member rewards sub-rows (reuses `MembershipTierRewardList` bound to
 *      `membershipTiers[0].id`) — same as paid card, but on the only tier.
 *      Preview Section 1.5 already reads from `membershipTiers[0].rewards`.
 *
 * No "remove tier" button — FreeState directly binds `membershipTiers[0]`
 * without rendering `MembershipTierRow`. Only 1 implicit tier exists for
 * free cards.
 *
 * Store guarantees:
 *   - `setIsPaid(false)` auto-seeds `membershipTiers[0]` if empty.
 *   - `setIsPaid(true)` clears the 3 free-card expiry fields.
 *   - The 3 expiry setters cross-clear the other field on mode change.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MembershipTierNameField } from './MembershipTierNameField';
import { MembershipTierRewardList } from './MembershipTierRewardList';
import { MembershipHasExpiryToggle } from './MembershipHasExpiryToggle';
import { MembershipExpiryModeField } from './MembershipExpiryModeField';
import { MembershipCustomExpiryDaysField } from './MembershipCustomExpiryDaysField';
import { MembershipSpecificExpiryDateField } from './MembershipSpecificExpiryDateField';
import type { MembershipCardLogicProps } from './MembershipCardLogic.types';

export function MembershipCardLogicFreeState({
  showValidation,
}: MembershipCardLogicProps) {
  const { t } = useTranslation('cardEditor');
  const membershipTiers = useCardBuilderStore((s) => s.membershipTiers);
  const hasExpiry = useCardBuilderStore((s) => s.hasExpiry);
  const membershipExpiryMode = useCardBuilderStore((s) => s.membershipExpiryMode);

  const freeTier = membershipTiers[0];

  // 2026-09-18 fix (regression): defensive seed in initialState +
  // loadSettings guarantees `membershipTiers[0]` exists whenever
  // `isPaid === false`. This fallback should be unreachable in normal
  // flows; if it ever fires it indicates a code path bypassed the
  // invariant (e.g. a test manually setState'd an empty array, or
  // someone refactored away the seed). Log a warning so the regression
  // is loud rather than silent.
  if (!freeTier) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[MembershipCardLogicFreeState] membershipTiers is empty when isPaid=false. ' +
        'This should not happen with proper initial-state seeding. ' +
        'Investigate loadSettings or reset path.',
      );
    }
    return (
      <section className="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">
          {t('step6.membership.freeStateHint')}
        </p>
      </section>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ===== 區塊 1: 會員等級（單一輸入框） ===== */}
      <section className="flex min-w-0 flex-col gap-3">
        <header className="flex flex-col gap-1">
          <h3
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('step6.membership.freeTierNameTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('step6.membership.introHint')}
          </p>
        </header>
        <MembershipTierNameField showValidation={showValidation} tierId={freeTier.id} />
      </section>

      {/* ===== 區塊 2: 卡片有效期限切換 ===== */}
      <MembershipHasExpiryToggle showValidation={showValidation} />

      {/* ===== 區塊 3: 當 hasExpiry=true 時顯示 ===== */}
      {hasExpiry && (
        <section className="flex min-w-0 flex-col gap-3 border-t border-dashed border-border pt-4">
          <MembershipExpiryModeField showValidation={showValidation} />

          {/* 對應模式的子輸入欄位 — 透過 membershipExpiryMode 條件渲染 */}
          {membershipExpiryMode === 'custom_days' && (
            <MembershipCustomExpiryDaysField showValidation={showValidation} />
          )}
          {membershipExpiryMode === 'specific_date' && (
            <MembershipSpecificExpiryDateField showValidation={showValidation} />
          )}
        </section>
      )}

      {/* ===== 區塊 4: 會員獎勵 sub-rows（復用 MembershipTierRewardList） ===== */}
      <MembershipTierRewardList showValidation={showValidation} tierId={freeTier.id} />
    </div>
  );
}
