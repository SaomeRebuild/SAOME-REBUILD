/**
 * LoadingOverlay — full-screen or scoped loading scrim.
 */

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingOverlayProps {
  visible: boolean;
  label?: string;
  children?: ReactNode;
}

export function LoadingOverlay({ visible, label, children }: LoadingOverlayProps) {
  if (!visible) return <>{children}</>;
  return (
    <div className="relative" aria-busy="true">
      {children}
      <div
        role="status"
        aria-live="polite"
        className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
      >
        <div className="flex items-center gap-2 rounded bg-white px-3 py-2 text-sm shadow">
          <Loader2 size={16} className="animate-spin" />
          <span>{label ?? 'Loading…'}</span>
        </div>
      </div>
    </div>
  );
}
