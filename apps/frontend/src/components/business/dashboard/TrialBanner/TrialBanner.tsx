/**
 * TrialBanner — tenant trial expiry warning banner.
 *
 * Renders ONLY when:
 *   - user is authenticated + role is 'tenant'
 *   - pass.plan === 'green' && pass.status === 'active'
 *
 * The live `daysLeft` is computed every second via setInterval inside
 * useTrialBanner so the countdown is always in sync with `endDate`.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { SubmitButton } from '@/components/ui/form/SubmitButton';
import { cn } from '@/lib/utils';
import type { TrialBannerProps } from './TrialBanner.types';

const DAYS_URGENT_THRESHOLD = 3;

export function TrialBanner({ daysLeft, endDate, onVerify }: TrialBannerProps) {
  const { t } = useTranslation('passNotification');

  const isUrgent = daysLeft <= DAYS_URGENT_THRESHOLD;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={`${t('trial.ariaLabel', { daysLeft })} ${endDate}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
        isUrgent
          ? 'border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10'
          : 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10',
      )}
    >
      {/* Icon */}
      <AlertTriangle
        aria-hidden="true"
        className={cn(
          'size-5 shrink-0',
          isUrgent ? 'text-[var(--color-destructive)]' : 'text-[var(--color-warning)]',
        )}
      />

      {/* Text */}
      <div className="flex-1">
        <p
          className={cn(
            'font-semibold',
            isUrgent
              ? 'text-[var(--color-destructive)]'
              : 'text-[var(--color-warning)]',
          )}
        >
          {isUrgent
            ? t('trial.titleUrgent', { days: daysLeft })
            : t('trial.title', { days: daysLeft })}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          {t('trial.subtitle', { days: daysLeft })}
        </p>
      </div>

      {/* CTA */}
      <SubmitButton
        onClick={onVerify}
        className={cn(
          'shrink-0 font-semibold',
          isUrgent
            ? 'bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]/90'
            : 'bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary)]/90',
        )}
      >
        {t('trial.cta')}
      </SubmitButton>
    </div>
  );
}
