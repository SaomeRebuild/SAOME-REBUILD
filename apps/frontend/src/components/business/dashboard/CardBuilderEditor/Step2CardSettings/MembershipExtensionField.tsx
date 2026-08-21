/**
 * MembershipExtensionField — 會員卡收費設定（僅 membership_card 顯示）
 *
 * Extension pattern: 只在 membership_card 時渲染。
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function MembershipExtensionField() {
  const { t } = useTranslation('cardEditor');
  const isPaid = useCardBuilderStore((s) => s.isPaid);
  const setIsPaid = useCardBuilderStore((s) => s.setIsPaid);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t('step2.membershipExtension.title')}</h3>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-input accent-primary"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t('step2.membershipExtension.isPaid')}</span>
          <span className="text-xs text-muted-foreground">
            {t('step2.membershipExtension.isPaidHint')}
          </span>
        </div>
      </label>
    </div>
  );
}
