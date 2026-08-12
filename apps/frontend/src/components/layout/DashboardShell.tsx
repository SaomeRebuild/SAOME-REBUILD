/**
 * DashboardShell — L3 layout component for admin/tenant routes.
 *
 * Wraps a dashboard page with:
 *   <DashboardHeader navItems={...} />
 *   <main>{children}</main>
 *   <DashboardFooter />
 *
 * RN migration: Shell concept is identical — only rendering primitives (<div> → <View>) change.
 */
import type { ReactNode } from 'react';
import { DashboardHeader } from '@/components/business/dashboard/DashboardHeader';
import { DashboardFooter } from '@/components/business/dashboard/DashboardFooter';
import type { NavItem } from '@/components/business/dashboard/DashboardHeader';

export interface DashboardShellProps {
  /** Nav items rendered in DashboardHeader */
  navItems?: NavItem[];
  children: ReactNode;
  className?: string;
}

export function DashboardShell({ navItems = [], children, className }: DashboardShellProps) {
  return (
    <div className={`flex flex-col ${className ?? ''}`} style={{ minHeight: '100dvh' }}>
      <DashboardHeader navItems={navItems} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <DashboardFooter />
    </div>
  );
}
