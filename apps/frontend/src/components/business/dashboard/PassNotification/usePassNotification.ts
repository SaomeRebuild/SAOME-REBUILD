/**
 * usePassNotification — determines which notification (if any) to show.
 *
 * @module components/business/dashboard/PassNotification
 */

import { useEffect, useState } from 'react';
import type { PassInfo } from '@saome/shared/types/auth';
import type { NotificationType } from './PassNotification.types';

const ONE_SECOND_MS = 1_000;
const ONE_DAY_MS = 86_400_000;

/** Compute live days remaining from an ISO 8601 date string. */
function computeDaysLeft(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / ONE_DAY_MS));
}

/**
 * Determines which notification variant to display based on pass data.
 *
 * Logic:
 * - `pass` is null → no notification
 * - `pass.paidAt === null` (trial):
 *   - daysRemaining > 0 → 'trial'
 *   - daysRemaining === 0 → 'trialExpired'
 * - `pass.paidAt !== null` (paid):
 *   - daysRemaining <= 7 → 'renewalReminder'
 *   - otherwise → null
 */
export function usePassNotification(pass: PassInfo | null): {
  type: NotificationType;
  daysLeft: number;
} {
  // Derive static values from pass (no setInterval needed — backend already
  // computes daysRemaining; we just use it directly).
  const rawDays = pass?.daysRemaining ?? 0;

  // For the countdown, use the backend's endDate as the authoritative source.
  const endDate = pass?.endDate ?? '';

  const [daysLeft, setDaysLeft] = useState<number>(() =>
    endDate ? computeDaysLeft(endDate) : rawDays,
  );

  // Sync live countdown with server-provided endDate.
  useEffect(() => {
    if (!endDate) return;

    const interval = window.setInterval(() => {
      setDaysLeft(computeDaysLeft(endDate));
    }, ONE_SECOND_MS);

    return () => window.clearInterval(interval);
  }, [endDate]);

  if (!pass || pass.status === 'cancelled') {
    return { type: null, daysLeft: 0 };
  }

  if (!pass.paidAt) {
    // Unpaid: trial
    return rawDays > 0
      ? { type: 'trial', daysLeft }
      : { type: 'trialExpired', daysLeft: 0 };
  }

  // Paid: renewal reminder if within 7 days of billing_cycle_end
  if (rawDays <= 7) {
    return { type: 'renewalReminder', daysLeft };
  }

  return { type: null, daysLeft: 0 };
}
