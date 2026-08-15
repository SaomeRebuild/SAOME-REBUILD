import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, ChevronRight, CreditCard, LayoutTemplate, Mail, Settings, Users, Menu } from 'lucide-react';
import { TenantToolbarItem } from './TenantToolbarItem';
import { createPortal } from 'react-dom';
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: Sticky toolbar with hover reveal */}
      <div className="group sticky left-0 top-16 z-50 hidden h-fit w-fit flex-col items-center lg:flex">
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

      {/* Mobile: Floating menu button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label={t('tenantToolbar.openMenu')}
        className="
          fixed bottom-6 left-6 z-40 flex h-12 w-12 items-center justify-center rounded-full
          bg-primary text-primary-foreground shadow-lg
          transition-all duration-150 hover:scale-105 hover:shadow-xl
          active:scale-95 lg:hidden
        "
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Mobile: Side panel menu — uses Portal */}
      {isMobileOpen && createPortal(
        <div className="fixed inset-0 z-[9999]">
          {/* Backdrop — semi-transparent but not full blur */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Menu panel — slides from left */}
          <div className="
            absolute left-0 top-0 h-full w-64 flex flex-col gap-4
            bg-card/95 backdrop-blur-md p-4 shadow-xl
            animate-in slide-in-from-left duration-200
          ">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {t('tenantToolbar.menuTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label={t('tenantToolbar.closeMenu')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <ChevronRight size={20} className="rotate-90" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Tenant tools">
              {TOOLS.map((tool) => (
                <TenantToolbarItem
                  key={tool.id}
                  id={tool.id}
                  i18nKey={tool.i18nKey}
                  icon={tool.icon}
                  href={tool.href}
                  isActive={pathname === tool.href}
                  onClick={() => setIsMobileOpen(false)}
                  isMobile
                />
              ))}
            </nav>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
