/**
 * Auth Logic Tests (Vitest)
 *
 * Per `.specify/memory/constitution.md` TDD-Mandatory:
 * - Tests exist for every pure function
 * - Red-Green-Refactor cycle kept (this is the green run after impl landed in shared/logic/auth.ts)
 *
 * Each test names one observable behavior; no over-mocking.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLockoutEndsAt,
  countRecentFailures,
  getLockedSecondsRemaining,
  getRoleHomePath,
  isAccountLocked,
  shouldShowLockoutUI,
} from './auth';
import { ROLE_ADMIN, ROLE_TENANT } from '../constants/role';

describe('getRoleHomePath', () => {
  it('returns /app/dashboard for tenant role', () => {
    expect(getRoleHomePath(ROLE_TENANT)).toBe('/app/dashboard');
  });

  it('returns /admin/dashboard for admin role', () => {
    expect(getRoleHomePath(ROLE_ADMIN)).toBe('/admin/dashboard');
  });
});

describe('isAccountLocked', () => {
  it('returns false when failures below threshold', () => {
    expect(isAccountLocked(0, 3)).toBe(false);
    expect(isAccountLocked(2, 3)).toBe(false);
  });

  it('returns true when failures equals threshold', () => {
    expect(isAccountLocked(3, 3)).toBe(true);
  });

  it('returns true when failures exceeds threshold', () => {
    expect(isAccountLocked(10, 3)).toBe(true);
  });
});

describe('getLockedSecondsRemaining', () => {
  it('returns 0 when lockout already ended', () => {
    expect(getLockedSecondsRemaining(0, 1_000)).toBe(0);
  });

  it('rounds up fractional seconds', () => {
    // 2.5s remaining → 3 sec (ceiling)
    expect(getLockedSecondsRemaining(2_500, 0)).toBe(3);
  });

  it('rounds down at whole-second boundary', () => {
    // 3s remaining exactly → 3 sec (no remainder)
    expect(getLockedSecondsRemaining(3_000, 0)).toBe(3);
  });

  it('returns exact seconds when whole-second boundary', () => {
    expect(getLockedSecondsRemaining(5_000, 0)).toBe(5);
  });
});

describe('buildLockoutEndsAt', () => {
  it('adds minutes as ms', () => {
    expect(buildLockoutEndsAt(0, 10)).toBe(10 * 60 * 1000);
    expect(buildLockoutEndsAt(1_000_000, 0)).toBe(1_000_000);
  });
});

describe('countRecentFailures', () => {
  const NOW = 10 * 60 * 1000;
  const WINDOW = 10 * 60 * 1000; // 10 min

  it('returns 0 when no attempts', () => {
    expect(countRecentFailures([], NOW, WINDOW)).toBe(0);
  });

  it('counts only failed attempts inside the window', () => {
    const a = [
      { attemptedAt: NOW - 60 * 1000, success: false }, // -1 min ✓
      { attemptedAt: NOW - 5 * 60 * 1000, success: false }, // -5 min ✓
      { attemptedAt: NOW - 9 * 60 * 1000, success: true }, // -9 min, success ✗(excluded)
      { attemptedAt: NOW - 15 * 60 * 1000, success: false }, // -15 min, outside ✗
    ];
    expect(countRecentFailures(a, NOW, WINDOW)).toBe(2);
  });

  it('accepts Date instances as well as ms numbers', () => {
    const a = [
      { attemptedAt: new Date(NOW - 60 * 1000), success: false },
    ];
    expect(countRecentFailures(a, NOW, WINDOW)).toBe(1);
  });
});

describe('shouldShowLockoutUI', () => {
  const WINDOW = 10 * 60 * 1000;

  it('false when failures < threshold', () => {
    expect(shouldShowLockoutUI(2, 3, 0, WINDOW / 2, WINDOW)).toBe(false);
  });

  it('true when failures >= threshold AND now within window', () => {
    const oldest = 0;
    const now = 9 * 60 * 1000; // 9 minutes after oldest
    expect(shouldShowLockoutUI(3, 3, oldest, now, WINDOW)).toBe(true);
  });

  it('false when window expired (now > oldest + window)', () => {
    const oldest = 0;
    const now = 11 * 60 * 1000; // 11 minutes after oldest
    expect(shouldShowLockoutUI(3, 3, oldest, now, WINDOW)).toBe(false);
  });
});
