/**
 * useLoginLockout — track failed login attempts and lockout timer in localStorage.
 */

import { useCallback, useEffect, useState } from 'react';
import { limits } from '@/config/limits';

const STORAGE_KEY = 'saome.login.lockout.v1';

interface LockoutState {
  failedCount: number;
  lockedUntil: number | null; // epoch ms
}

function readState(): LockoutState {
  if (typeof window === 'undefined') return { failedCount: 0, lockedUntil: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { failedCount: 0, lockedUntil: null };
    return JSON.parse(raw) as LockoutState;
  } catch {
    return { failedCount: 0, lockedUntil: null };
  }
}

function writeState(s: LockoutState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

export function useLoginLockout() {
  const [state, setState] = useState<LockoutState>(readState);

  // Tick down lockedUntil.
  useEffect(() => {
    if (!state.lockedUntil) return;
    const id = setInterval(() => {
      setState((s) => {
        if (!s.lockedUntil) return s;
        if (Date.now() >= s.lockedUntil) {
          const next = { failedCount: 0, lockedUntil: null };
          writeState(next);
          return next;
        }
        return s;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.lockedUntil]);

  const recordFailure = useCallback(() => {
    setState((s) => {
      const failedCount = s.failedCount + 1;
      const lockedUntil =
        failedCount >= limits.loginMaxAttempts
          ? Date.now() + limits.loginLockoutSeconds * 1000
          : null;
      const next = { failedCount, lockedUntil };
      writeState(next);
      return next;
    });
  }, []);

  const recordSuccess = useCallback(() => {
    setState({ failedCount: 0, lockedUntil: null });
    writeState({ failedCount: 0, lockedUntil: null });
  }, []);

  const isLocked = state.lockedUntil != null && Date.now() < state.lockedUntil;
  const remainingSec = isLocked && state.lockedUntil
    ? Math.ceil((state.lockedUntil - Date.now()) / 1000)
    : 0;
  const failedCount = state.failedCount;

  return { isLocked, remainingSec, failedCount, recordFailure, recordSuccess };
}
