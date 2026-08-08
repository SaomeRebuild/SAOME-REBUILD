import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  key: string;       // i18n key for label
  href: string;      // internal route or external URL
  icon?: LucideIcon; // optional Lucide icon, defaults to none
  external?: boolean; // open in new tab
}

export interface DashboardHeaderProps {
  /** Nav items rendered in the top-level nav bar */
  navItems?: NavItem[];
  className?: string;
}
