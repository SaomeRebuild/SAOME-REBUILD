/**
 * PassHolderShell — L3 layout for the public "Get Pass" page.
 *
 * Renders: <PassHolderHeader /> + <main>{children}</main> + <DashboardFooter />
 *
 * This shell is intentionally minimal:
 *   - Public route (no auth, no nav bar)
 *   - ThemeProvider is inherited from the root App; we do not re-mount it
 *   - Reuses the existing DashboardFooter so the public page still surfaces
 *     legal links (privacy / terms) without duplicating its i18n strings
 *
 * Mobile-first per .cursor/rules/013-rwd.mdc: header collapses gracefully
 * to a single line with a 48×48 logo / icon fallback.
 */

import type { ReactNode } from 'react';
import { DashboardFooter } from '@/components/business/dashboard/DashboardFooter';
import { PassHolderHeader } from './PassHolderHeader';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

export interface PassHolderShellProps {
  /** Public-safe template metadata. Pass `null` while loading. */
  template: PublicPassTemplate | null;
  children: ReactNode;
  className?: string;
}

export function PassHolderShell({ template, children, className }: PassHolderShellProps) {
  return (
    <div
      className={`flex flex-col bg-[var(--color-background)] ${className ?? ''}`}
      style={{ minHeight: '100dvh' }}
    >
      <PassHolderHeader template={template} />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 md:py-8">
        {children}
      </main>
      <DashboardFooter />
    </div>
  );
}