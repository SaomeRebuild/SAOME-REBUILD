/**
 * DashboardFooter — L2 business component.
 * Minimal one-line footer for dashboard pages.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardFooterProps {
  className?: string;
}

export function DashboardFooter({ className }: DashboardFooterProps) {
  const { t } = useTranslation('dashboard');

  return (
    <footer
      className={cn(
        'w-full border-t py-4 px-6',
        'bg-[var(--color-card)] border-[var(--color-border)]',
        'flex flex-col sm:flex-row items-center justify-between gap-2 text-xs',
        'text-[var(--color-muted-foreground)]',
        className,
      )}
    >
      <span data-testid="dashboard-footer-copyright">{t('dashboardFooter.copyright')}</span>
      <Link
        to="/privacy"
        className="hover:text-[var(--color-foreground)] transition-colors"
      >
        {t('dashboardFooter.privacy')}
      </Link>
    </footer>
  );
}
