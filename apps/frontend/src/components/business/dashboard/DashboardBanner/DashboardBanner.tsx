import { PassNotification } from '@/components/business/dashboard/PassNotification';
import type { PassNotificationProps } from '@/components/business/dashboard/PassNotification/PassNotification.types';

export interface DashboardBannerProps {
  /** Pass data for trial/renewal banners (from auth state) */
  pass?: PassNotificationProps['pass'];
  /** CTA click handler */
  onCta?: PassNotificationProps['onCta'];
}

export function DashboardBanner({ pass, onCta }: DashboardBannerProps) {
  if (!pass) return null;

  return (
    <div className="flex flex-col gap-3">
      <PassNotification pass={pass} onCta={onCta ?? (() => {})} />
    </div>
  );
}
