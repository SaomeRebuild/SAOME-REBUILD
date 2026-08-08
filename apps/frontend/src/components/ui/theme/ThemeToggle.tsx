/**
 * ThemeToggle — L1 UI component.
 * Three-segment toggle: light / dark / system.
 *
 * RN migration: replace `lucide-react` icons with `lucide-react-native`.
 * Component structure stays identical.
 */
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks';
import type { ThemePreference } from '@/hooks';

const OPTIONS: ThemePreference[] = ['light', 'dark'];

const ICON_MAP: Record<ThemePreference, React.ComponentType<{ size?: number; className?: string }>> = {
  light: Sun,
  dark: Moon,
};

const LABEL_KEY: Record<ThemePreference, string> = {
  light: 'theme.light',
  dark: 'theme.dark',
};

interface ThemeToggleProps {
  className?: string;
  /** Use transparent style inside mobile drawer to match LanguageSwitcher */
  transparent?: boolean;
}

export function ThemeToggle({ className, transparent }: ThemeToggleProps) {
  const { t } = useTranslation('theme');
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label={t('theme.toggleLabel')}
      className={cn(
        'flex items-center rounded-md gap-1 group-hover:bg-[var(--color-muted)] transition-colors',
        transparent
          ? 'bg-transparent border border-transparent px-4 py-3'
          : 'bg-[var(--color-muted)] border border-[var(--color-border)] p-1',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = ICON_MAP[opt];
        const isActive = preference === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => setPreference(opt)}
            aria-pressed={isActive}
            aria-label={t(LABEL_KEY[opt])}
            title={t(LABEL_KEY[opt])}
            className={cn(
              'flex items-center justify-center rounded-md transition-colors w-7 h-7 md:w-8 md:h-8',
              isActive
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm'
                : 'text-[var(--color-foreground)]',
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
