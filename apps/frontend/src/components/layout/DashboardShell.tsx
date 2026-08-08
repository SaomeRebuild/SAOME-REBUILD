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
    <div className={`flex min-h-dvh flex-col ${className ?? ''}`}>
      <DashboardHeader navItems={navItems} />
      <main className="flex-1">{children}</main>
      <DashboardFooter />
    </div>
  );
}
