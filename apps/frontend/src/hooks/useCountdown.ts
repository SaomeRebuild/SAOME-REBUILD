/**
 * useCountdown — generic countdown hook. Returns remaining seconds + isRunning state.
 */

import { useEffect, useRef, useState } from 'react';

export interface UseCountdownOptions {
  seconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useCountdown({ seconds, onComplete, autoStart = true }: UseCountdownOptions) {
  const [remaining, setRemaining] = useState(seconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          if (onComplete) onComplete();
          return 0;
        }
        return next;
      });
    }, 1000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [isRunning, onComplete]);

  return { remaining, isRunning };
}
