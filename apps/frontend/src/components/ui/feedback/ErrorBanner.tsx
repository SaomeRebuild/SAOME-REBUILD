/**
 * ErrorBanner — top-of-form inline error banner.
 *
 * Visual contract (per design-system/MASTER.md §1):
 *   - Bg:        var(--color-destructive) at 10% opacity
 *   - Border:    var(--color-destructive)
 *   - Text:      var(--color-destructive)
 *   - Icon:      AlertCircle (Lucide)
 */

import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface ErrorBannerProps {
  message?: string;
  children?: ReactNode;
}

export function ErrorBanner({ message, children }: ErrorBannerProps) {
  const hasMessage = Boolean(message);
  const hasChildren = Boolean(children);
  if (!hasMessage && !hasChildren) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
      style={{
        borderColor: 'var(--color-destructive)',
        backgroundColor: 'color-mix(in srgb, var(--color-destructive) 10%, transparent)',
        color: 'var(--color-destructive)',
      }}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div>{message ?? children}</div>
    </div>
  );
}
