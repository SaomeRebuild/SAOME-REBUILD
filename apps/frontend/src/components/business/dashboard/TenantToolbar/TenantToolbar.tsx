import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronRight, CreditCard, LayoutTemplate, Mail, Settings, Users } from 'lucide-react';
import { TenantToolbarItem } from './TenantToolbarItem';
import type { TenantToolbarProps } from './TenantToolbar.types';

const TOOLS = [
  { id: 'charts', i18nKey: 'tenantToolbar.charts', icon: BarChart3 },
  { id: 'cardEditor', i18nKey: 'tenantToolbar.cardEditor', icon: LayoutTemplate },
  { id: 'members', i18nKey: 'tenantToolbar.members', icon: Users },
  { id: 'email', i18nKey: 'tenantToolbar.email', icon: Mail },
  { id: 'billing', i18nKey: 'tenantToolbar.billing', icon: CreditCard },
  { id: 'settings', i18nKey: 'tenantToolbar.settings', icon: Settings },
] as const;

export function TenantToolbar({
  defaultWidth: _defaultWidth,
  onWidthChange: _onWidthChange,
}: TenantToolbarProps) {
  const { t } = useTranslation('dashboard');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="group relative flex w-fit">
      {/* Expand button — visible only when collapsed AND hovering on left edge */}
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label={t('tenantToolbar.expandTooltip')}
          className="absolute left-0 top-1/2 z-10 flex h-48 -translate-y-1/2 items-center justify-center rounded-l-md border bg-card text-muted-foreground shadow-sm opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}

      {/* Toolbar panel */}
      <div
        className={`
          relative flex h-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground
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
            flex flex-1 flex-col items-center justify-center gap-1 overflow-hidden p-2 scrollbar-hide
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
              isActive={activeTool === tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
