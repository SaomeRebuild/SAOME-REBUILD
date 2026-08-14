import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { TenantToolbarItemProps } from './TenantToolbarItem.types';

export function TenantToolbarItem({
  id,
  i18nKey,
  icon: Icon,
  isActive = false,
  href,
  onClick,
}: TenantToolbarItemProps) {
  const { t } = useTranslation('dashboard');
  const labelText = t(i18nKey);

  const content = (
    <>
      <Icon
        size={20}
        aria-hidden="true"
        className="transition-transform duration-200"
      />
      <span className="truncate text-xs font-medium">{labelText}</span>
    </>
  );

  const baseClasses = cn(
    'group/tool relative flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-transparent p-2 transition-all duration-200',
    'hover:border-border hover:bg-[#F97316] hover:text-white hover:font-bold hover:shadow-[6px_8px_16px_rgba(255,255,255,0.15)] hover:scale-105 hover:-translate-y-1',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    // Icon animation
    'hover:[&_svg]:scale-125',
    isActive
      ? 'border-[#F97316] bg-[#F97316] text-white shadow-md hover:shadow-[6px_8px_16px_rgba(255,255,255,0.15)] hover:scale-105 hover:-translate-y-1'
      : 'text-muted-foreground hover:bg-[#F97316] hover:text-white hover:font-bold'
  );

  if (href) {
    return (
      <Link
        to={href}
        id={id}
        aria-label={labelText}
        aria-current={isActive ? 'page' : undefined}
        className={baseClasses}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      aria-label={labelText}
      aria-current={isActive ? 'page' : undefined}
      className={baseClasses}
    >
      {content}
    </button>
  );
}
