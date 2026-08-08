/**
 * MarketingShell — L3 layout component for public marketing routes.
 *
 * Wraps a public page with:
 *   <Header />        ← existing marketing Header (with scroll effects, etc.)
 *   <main>{children}</main>
 *   <Footer />       ← existing marketing Footer
 *
 * This component is a thin wrapper — it exists to mirror DashboardShell's API,
 * so App.tsx can use a uniform {shell} pattern without branching on route type.
 */
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export interface MarketingShellProps {
  children: ReactNode;
  className?: string;
}

export function MarketingShell({ children, className }: MarketingShellProps) {
  return (
    <div className={`flex min-h-dvh flex-col ${className ?? ''}`}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
