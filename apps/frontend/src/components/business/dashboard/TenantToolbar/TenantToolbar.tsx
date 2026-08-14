import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronRight, CreditCard, LayoutTemplate, Mail, Settings, Users } from 'lucide-react';
import { TenantToolbarItem } from './TenantToolbarItem';
import type { TenantToolbarProps } from './TenantToolbar.types';

export const TOOLS = [
  { id: 'charts', i18nKey: 'tenantToolbar.charts', icon: BarChart3, href: '/app/dashboard/charts' },
  { id: 'cardBuilder', i18nKey: 'tenantToolbar.cardBuilder', icon: LayoutTemplate, href: '/app/dashboard/card-builder' },
  { id: 'members', i18nKey: 'tenantToolbar.members', icon: Users, href: '/app/dashboard/members' },
  { id: 'email', i18nKey: 'tenantToolbar.email', icon: Mail, href: '/app/dashboard/email' },
  { id: 'billing', i18nKey: 'tenantToolbar.billing', icon: CreditCard, href: '/app/dashboard/billing' },
  { id: 'settings', i18nKey: 'tenantToolbar.settings', icon: Settings, href: '/app/dashboard/settings' },
] as const;

export function TenantToolbar({
  defaultWidth: _defaultWidth,
  onWidthChange: _onWidthChange,
}: TenantToolbarProps) {
  const { t } = useTranslation('dashboard');
  const { pathname } = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="group sticky left-0 top-16 z-50 flex h-fit w-fit flex-col items-center">
      {/* Expand button — visible only when collapsed AND hovering on left edge */}
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label={t('tenantToolbar.expandTooltip')}
          className="fixed left-0 top-1/2 z-10 flex h-48 -translate-y-1/2 items-center justify-center rounded-l-md border bg-card text-muted-foreground shadow-sm opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}

      {/* Toolbar panel */}
      <div
        className={`
          relative flex flex-col rounded-xl border bg-card text-card-foreground
          transition-all duration-200 ease-out
          ${isCollapsed ? 'w-0 border-transparent' : 'border-border'}
        `}
        aria-label="Tenant tools"
      >
        {/* Collapse button */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label={t('tenantToolbar.collapseTooltip')}
            className="absolute right-0 top-1/2 z-10 flex h-48 -translate-y-1/2 items-center justify-center rounded-l-md bg-primary text-primary-foreground shadow-md opacity-0 transition-opacity hover:bg-primary/90 group-hover:opacity-100"
          >
            <ChevronRight size={12} aria-hidden="true" />
          </button>
        )}

        {/* Content */}
        <div
          className={`
            flex flex-col items-center justify-center gap-1 overflow-hidden p-2 scrollbar-hide
            transition-all duration-200 ease-out
            ${isCollapsed ? 'opacity-0 scale-x-0 w-0' : 'opacity-100 scale-x-100'}
          `}
        >
          {TOOLS.map((tool) => (
            <TenantToolbarItem
              key={tool.id}
              id={tool.id}
              i18nKey={tool.i18nKey}
              icon={tool.icon}
              href={tool.href}
              isActive={pathname === tool.href}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
