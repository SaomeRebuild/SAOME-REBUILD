/**
 * TrialBanner — warns tenants on green (trial) plan that their trial is expiring.
 *
 * Shows days remaining + a CTA to verify + bind a credit card before expiry.
 * Only renders when `state.pass?.plan === 'green' && state.pass?.status === 'active'`.
 */

import { TrialBanner } from './TrialBanner';
export { TrialBanner };
export type {
  TrialBannerProps,
  TrialBannerDaysLeft,
} from './TrialBanner.types';
