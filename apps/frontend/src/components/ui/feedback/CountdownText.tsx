/**
 * CountdownText — shows a countdown in mm:ss format.
 */

import { useEffect, useState } from 'react';

export interface CountdownTextProps {
  /** Total seconds to count down. */
  seconds: number;
  onComplete?: () => void;
  format?: (m: number, s: number) => string;
  className?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const defaultFormat = (m: number, s: number) => `${pad(m)}:${pad(s)}`;

export function CountdownText({
  seconds,
  onComplete,
  format = defaultFormat,
  className,
}: CountdownTextProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) {
          clearInterval(id);
          if (onComplete) onComplete();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onComplete]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <span className={className} aria-live="polite">
      {format(m, s)}
    </span>
  );
}
