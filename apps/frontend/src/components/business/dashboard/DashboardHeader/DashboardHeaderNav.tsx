/**
 * DashboardHeaderNav — renders nav items with active state.
 *
 * RN migration: `<a href>` → `<Pressable onPress={navigate}>` with react-router navigation.
 * Component structure is identical; only the rendering primitives change.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { NavItem } from './DashboardHeader.types';

interface DashboardHeaderNavProps {
  items: NavItem[];
  className?: string;
}

export function DashboardHeaderNav({ items, className }: DashboardHeaderNavProps) {
  const { t } = useTranslation('dashboard');
  if (!items.length) return null;

  return (
    <nav className={cn('hidden items-center gap-1 lg:flex', className)} aria-label="Dashboard navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            to={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'text-[var(--color-muted-foreground)]',
              'hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
