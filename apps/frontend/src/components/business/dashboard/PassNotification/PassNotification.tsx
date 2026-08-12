/**
 * PassNotification — renders trial / expired / renewal reminder banner.
 *
 * @module components/business/dashboard/PassNotification
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, CreditCard } from 'lucide-react';
import { SubmitButton } from '@/components/ui/form/SubmitButton';
import { cn } from '@/lib/utils';
import type { PassNotificationProps } from './PassNotification.types';
import { usePassNotification } from './usePassNotification';

const DAYS_URGENT_THRESHOLD = 3;

function NotificationIcon({ type }: { type: 'trial' | 'trialExpired' | 'renewalReminder' }) {
  if (type === 'trialExpired') {
    return <CheckCircle aria-hidden="true" className="size-5 shrink-0 text-[var(--color-destructive)]" />;
  }
  if (type === 'renewalReminder') {
    return <CreditCard aria-hidden="true" className="size-5 shrink-0 text-[var(--color-warning)]" />;
  }
  return <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-[var(--color-warning)]" />;
}

export function PassNotification({ pass, onCta }: PassNotificationProps) {
  const { t } = useTranslation('passNotification');
  const { type, daysLeft, plan } = usePassNotification(pass);

  if (!type) return null;

  const isUrgent = type === 'trial' && daysLeft <= DAYS_URGENT_THRESHOLD;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={t(`${type}.ariaLabel`, { days: daysLeft, plan })}
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
        type === 'trialExpired'
          ? 'border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10'
          : 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10',
      )}
    >
      <NotificationIcon type={type} />

      {/* Text */}
      <div className="flex-1">
        <p
          className={cn(
            'font-semibold',
            type === 'trialExpired'
              ? 'text-[var(--color-destructive)]'
              : isUrgent
                ? 'text-[var(--color-destructive)]'
                : 'text-[var(--color-warning)]',
          )}
        >
          {isUrgent
            ? t(`${type}.titleUrgent`, { days: daysLeft })
            : t(`${type}.title`, { days: daysLeft })}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          {t(`${type}.subtitle`, { days: daysLeft, plan })}
        </p>
      </div>

      {/* CTA */}
      <SubmitButton
        onClick={onCta}
        className={cn(
          'shrink-0 font-semibold',
          type === 'trialExpired'
            ? 'bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]/90'
            : 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary)]/90',
        )}
      >
        {t(`${type}.cta`)}
      </SubmitButton>
    </div>
  );
}
