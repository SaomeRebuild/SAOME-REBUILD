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
  /** Click handler */
  onClick?: () => void;
}
