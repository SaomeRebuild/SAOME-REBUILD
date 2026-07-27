/**
 * ErrorBanner — top-of-form inline error banner.
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
      className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div>{message ?? children}</div>
    </div>
  );
}
