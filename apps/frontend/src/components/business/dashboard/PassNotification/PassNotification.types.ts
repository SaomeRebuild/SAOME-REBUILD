/**
 * PassNotification.types — exported types for the PassNotification business component.
 *
 * @module components/business/dashboard/PassNotification
 */

import type { PassInfo } from '@saome/shared/types/auth';

/** Three notification variants driven by usePassNotification */
export type NotificationType = 'trial' | 'trialExpired' | 'renewalReminder' | null;

/** Live state from the hook */
export interface PassNotificationState {
  type: NotificationType;
  daysLeft: number;
}

/** Props passed into the component */
export interface PassNotificationProps {
  /** Opaque pass data from auth state (may be null) */
  pass: PassInfo | null;
  /** Called when the user clicks any CTA */
  onCta: () => void;
}
