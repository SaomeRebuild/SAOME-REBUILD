import type { LucideIcon } from 'lucide-react';

export interface TenantToolbarItemProps {
  /** Unique identifier for the tool */
  id: string;
  /** i18n translation key, e.g. "dashboard.tenantToolbar.charts" */
  i18nKey: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Whether the tool is currently active */
  isActive?: boolean;
  /** Link destination — when provided, renders as <Link> instead of <button> */
  href?: string;
  /** Click handler (only used when href is not provided) */
  onClick?: () => void;
  /** Whether the item is rendered in mobile menu (horizontal layout) */
  isMobile?: boolean;
}
