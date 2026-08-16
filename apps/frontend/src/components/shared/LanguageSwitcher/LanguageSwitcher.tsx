import { setLanguage } from '../../../i18n';
import type { LanguageCode } from './LanguageSwitcher.types';

const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'zh-TW', label: '中文' },
  { code: 'en', label: 'EN' },
];

interface LanguageSwitcherProps {
  separator?: string;
}

export function LanguageSwitcher({ separator = '|' }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-2 rounded-md px-4 py-3 group-hover:bg-[var(--color-muted)] transition-colors">
      {LANGUAGES.map((lang, index) => (
        <span key={lang.code} className="contents">
          {index > 0 && (
            <span style={{ color: 'var(--color-border)' }}>{separator}</span>
          )}
          <button
            onClick={() => setLanguage(lang.code)}
            className="text-sm transition-colors hover:opacity-80 rounded px-1"
            style={{ color: 'var(--color-foreground)' }}
          >
            {lang.label}
          </button>
        </span>
      ))}
    </div>
  );
}
