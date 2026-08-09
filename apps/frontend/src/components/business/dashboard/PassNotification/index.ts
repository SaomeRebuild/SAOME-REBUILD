/**
 * PassNotification — trial / expired / renewal reminder banner.
 *
 * Replaces the old TrialBanner. Handles three notification types:
 *   - 'trial': unpaid + days > 0
 *   - 'trialExpired': unpaid + days === 0
 *   - 'renewalReminder': paid + days <= 7
 */

import { PassNotification } from './PassNotification';
export { PassNotification };
export type { NotificationType, PassNotificationProps, PassNotificationState } from './PassNotification.types';
export { usePassNotification } from './usePassNotification';
