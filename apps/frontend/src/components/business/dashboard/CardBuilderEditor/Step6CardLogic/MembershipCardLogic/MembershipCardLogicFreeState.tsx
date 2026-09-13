/**
 * MembershipCardLogicFreeState — Empty state for 免費會員卡.
 *
 * Shown by `MembershipCardLogic` when `isPaid === false`. No editor / no
 * fields — 免費會員卡無需付費設定.
 *
 * The hint reminds the user to enable "需收費" in Step 2 if they want to
 * configure paid membership tiers.
 */

import { useTranslation } from 'react-i18next';
import { InfoIcon } from 'lucide-react';

export function MembershipCardLogicFreeState() {
  const { t } = useTranslation('cardEditor');

  return (
    <section className="flex min-w-0 flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-6">
      <div className="flex items-center gap-2">
        <InfoIcon size={20} aria-hidden="true" className="text-muted-foreground" />
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.membership.freeStateTitle')}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('step6.membership.freeStateHint')}
      </p>
    </section>
  );
}