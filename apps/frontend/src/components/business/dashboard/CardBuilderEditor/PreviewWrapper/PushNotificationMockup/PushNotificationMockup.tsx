/**
 * PushNotificationMockup — Visual mockup of an iOS/Android push notification
 * rendered inside the PhoneFrame (NOT on the card itself).
 *
 * Phase 9 of IconUploader plan (2026-08-31):
 * - Lives at PreviewWrapper/PushNotificationMockup (sub-component of PreviewWrapper).
 * - Icon is loaded with `?token=…&v=…` per Rule 028 § 13 (cache busting) and
 *   § 14 (img auth strategy: <img> can't send cookies, query token required).
 * - i18n: t('cardEditor:step3.pushNotification.label') — namespace already
 *   registered in Phase 2.
 *
 * @module components/business/dashboard/CardBuilderEditor/PreviewWrapper/PushNotificationMockup
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import type { PushNotificationMockupProps } from './PushNotificationMockup.types';

export function PushNotificationMockup({
  iconImageVersion,
  issuerName,
}: PushNotificationMockupProps) {
  const { t } = useTranslation('cardEditor');
  const cardId = useCardBuilderStore((s) => s.cardId);
  // Defensive: cardId can be null in create-draft mode; skip rendering if so.
  if (!cardId) return null;
  const iconUrl =
    `${api.baseUrl}${api.paths.cardImage(cardId, 'icon')}` +
    `?token=${encodeURIComponent(getAccessToken() ?? '')}` +
    (iconImageVersion ? `&v=${iconImageVersion}` : '');

  return (
    <div
      data-testid="push-notification-mockup"
      className="
        pointer-events-none absolute left-2 right-2 top-2 z-10
        flex items-start gap-2 rounded-xl bg-card p-2 shadow-md
        ring-1 ring-black/5
      "
    >
      {/* icon — 36×36 thumbnail matching iOS/Android push notification size */}
      <img
        src={iconUrl}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold text-foreground">
          {issuerName || 'Card Issuer'}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {t('step3.pushNotification.label')}
        </span>
      </div>
    </div>
  );
}
