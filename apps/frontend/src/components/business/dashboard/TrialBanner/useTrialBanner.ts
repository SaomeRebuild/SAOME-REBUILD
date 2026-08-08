/**
 * useTrialBanner — computes live days-remaining countdown for the TrialBanner.
 *
 * Uses setInterval to recompute `daysLeft` every second from the server-provided
 * `endDate`, avoiding any polling of the backend after login/refresh.
 *
 * Returns null when the banner should not render (no green active pass, or
 * the trial has already expired).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const ONE_SECOND_MS = 1_000;
const ONE_DAY_MS = 86_400_000;

function computeDaysLeft(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  // Ceil so that "12.1 hours left" shows "13 days" rather than "12 days".
  return Math.max(0, Math.ceil(diff / ONE_DAY_MS));
}

export function useTrialBanner() {
  const { state } = useAuth();
  const { pass } = state;

  const [daysLeft, setDaysLeft] = useState<number>(() =>
    pass?.endDate ? computeDaysLeft(pass.endDate) : 0,
  );

  // Re-compute every second while the banner is mounted.
  useEffect(() => {
    if (!pass?.endDate) return;

    const interval = window.setInterval(() => {
      setDaysLeft(computeDaysLeft(pass.endDate));
    }, ONE_SECOND_MS);

    return () => window.clearInterval(interval);
  }, [pass?.endDate]);

  // Should the banner render?
  const visible =
    pass !== null &&
    (pass.plan === 'green' || pass.plan === 'gold' || pass.plan === 'platinum') &&
    pass.status === 'active' &&
    daysLeft > 0;

  return { daysLeft, endDate: pass?.endDate ?? '', visible };
}
