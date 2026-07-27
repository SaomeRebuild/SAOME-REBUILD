/**
 * AuthLanguageSwitcher — toggle between zh-TW and en for auth pages.
 */

import { useTranslation } from 'react-i18next';

export function AuthLanguageSwitcher() {
  const { i18n } = useTranslation();
  const next = i18n.language === 'zh-TW' ? 'en' : 'zh-TW';
  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      className="min-h-[32px] rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
      aria-label="Toggle language"
    >
      {next === 'zh-TW' ? '繁體中文' : 'English'}
    </button>
  );
}

export default AuthLanguageSwitcher;