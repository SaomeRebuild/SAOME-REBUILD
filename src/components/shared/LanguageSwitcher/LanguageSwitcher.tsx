import i18n from '../../../i18n';
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
    <div className="flex items-center gap-2">
      {LANGUAGES.map((lang, index) => (
        <span key={lang.code} className="contents">
          {index > 0 && (
            <span style={{ color: 'var(--color-border)' }}>{separator}</span>
          )}
          <button
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`text-xs transition-opacity hover:opacity-80 ${
              i18n.language === lang.code ? 'font-bold' : ''
            }`}
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {lang.label}
          </button>
        </span>
      ))}
    </div>
  );
}
