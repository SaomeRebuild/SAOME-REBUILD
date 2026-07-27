/**
 * Auth Logic - Pure Business Functions
 *
 * @module shared/logic/auth
 * @description TDD-driven; failing tests live in logic/auth.test.ts
 */

import { ROLE_HOME_PATH, type Role } from '../constants/role';

/**
 * Return the dashboard path appropriate for the given role.
 * Shared between frontend (useAuthRedirect hook) and backend (cookie path + CORS allowed UI).
 */
export function getRoleHomePath(role: Role): string {
  return ROLE_HOME_PATH[role];
}

/**
 * Check if the account is currently in lockout state.
 *
 * Lockout threshold (3) and window length (10 minutes) live in config/limits.ts.
 * This pure function only encodes the decision; it does not read clock, storage, or DB.
 *
 * @param failuresInWindow - number of failed attempts in the active 10-min window
 * @param threshold - LOCKOUT_THRESHOLD; pass-through for testing flexibility
 * @returns true if `failuresInWindow >= threshold` (lockout should be enforced)
 */
export function isAccountLocked(failuresInWindow: number, threshold: number): boolean {
  return failuresInWindow >= threshold;
}

/**
 * Compute remaining lockout seconds.
 *
 * @param lockoutEndsAt - unix-ms timestamp when the lockout expires (>= now → still locked)
 * @param nowMs - current time in unix-ms; pass-through for testing
 * @returns integer seconds remaining (0 if lockout already expired)
 */
export function getLockedSecondsRemaining(lockoutEndsAt: number, nowMs: number): number {
  const diff = lockoutEndsAt - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}

/**
 * Build a lockout-ends timestamp from a starting unix-ms + duration in minutes.
 *
 * Pure; used by useLoginLockout on client (and reused server-side by tests).
 */
export function buildLockoutEndsAt(startedAtMs: number, durationMin: number): number {
  return startedAtMs + durationMin * 60 * 1000;
}

/**
 * Window-relative failure count.
 * Given a list of login attempts with timestamps, return how many of those fall in
 * `[nowMs - windowMs, nowMs]` and are `success === false`.
 *
 * @param attempts - attempts with `attemptedAt: Date | number (ms)` and `success: boolean`
 * @param nowMs - now in unix-ms
 * @param windowMs - sliding window size (e.g. 10 * 60 * 1000)
 */
export function countRecentFailures(
  attempts: ReadonlyArray<{ attemptedAt: Date | number; success: boolean }>,
  nowMs: number,
  windowMs: number,
): number {
  const cutoff = nowMs - windowMs;
  return attempts.filter((a) => {
    if (a.success) return false;
    const ts = a.attemptedAt instanceof Date ? a.attemptedAt.getTime() : a.attemptedAt;
    return ts >= cutoff && ts <= nowMs;
  }).length;
}

/**
 * Map a recent-failures count + window age to a policy decision.
 * - failures < threshold → not locked
 * - failures >= threshold within the lockout duration → still locked
 *
 * This is a convenience wrapper that decides "should the user be told they are locked?"
 * given the most recent failed attempt's timestamp + the count above the threshold.
 *
 * @param failures - already-counted failures in the active window
 * @param threshold - threshold constant
 * @param oldestFailureMs - unix-ms timestamp of the most recent (i.e. latest in window) failure
 * @param nowMs - now
 * @param windowMs - sliding window (e.g. 10 minutes)
 */
export function shouldShowLockoutUI(
  failures: number,
  threshold: number,
  oldestFailureMs: number,
  nowMs: number,
  windowMs: number,
): boolean {
  if (failures < threshold) return false;
  const windowEnd = oldestFailureMs + windowMs;
  return nowMs < windowEnd;
}
