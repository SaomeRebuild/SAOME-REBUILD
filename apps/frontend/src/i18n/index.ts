import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import authZhTW from './locales/auth.zh-TW';
import authEn from './locales/auth.en';
import dashboardZhTW from './locales/dashboard.zh-TW';
import dashboardEn from './locales/dashboard.en';
import passNotificationZhTW from './locales/passNotification.zh-TW';
import passNotificationEn from './locales/passNotification.en';
import themeZhTW from './locales/theme.zh-TW';
import themeEn from './locales/theme.en';
import landingZhTW from './locales/landing.zh-TW';
import landingEn from './locales/landing.en';
import legalZhTW from './locales/legal.zh-TW';
import legalEn from './locales/legal.en';
import pricingZhTW from './locales/pricing.zh-TW';
import pricingEn from './locales/pricing.en';
import navZhTW from './locales/nav.zh-TW';
import navEn from './locales/nav.en';
import memberZhTW from './locales/member.zh-TW';
import memberEn from './locales/member.en';
import cardBuilderZhTW from './locales/cardBuilder.zh-TW';
import cardBuilderEn from './locales/cardBuilder.en';
import cardEditorZhTW from './locales/cardEditor.zh-TW';
import cardEditorEn from './locales/cardEditor.en';
import passCardZhTW from './locales/passCard.zh-TW';
import passCardEn from './locales/passCard.en';

const resources = {
  'zh-TW': {
    auth: authZhTW,
    dashboard: dashboardZhTW,
    passNotification: passNotificationZhTW,
    theme: themeZhTW,
    landing: landingZhTW,
    legal: legalZhTW,
    pricing: pricingZhTW,
    nav: navZhTW,
    member: memberZhTW,
    cardBuilder: cardBuilderZhTW,
    cardEditor: cardEditorZhTW,
    passCard: passCardZhTW,
  },
  en: {
    auth: authEn,
    dashboard: dashboardEn,
    passNotification: passNotificationEn,
    theme: themeEn,
    landing: landingEn,
    legal: legalEn,
    pricing: pricingEn,
    nav: navEn,
    member: memberEn,
    cardBuilder: cardBuilderEn,
    cardEditor: cardEditorEn,
    passCard: passCardEn,
  },
};

const LANGUAGE_KEY = 'saome.lang';

/** Read persisted language, mirroring the useTheme pattern. */
function getInitialLanguage(): string {
  try {
    const persisted = localStorage.getItem(LANGUAGE_KEY);
    if (persisted === 'en' || persisted === 'zh-TW') return persisted;
  } catch {
    // SSR or blocked localStorage — fall through
  }
  return 'zh-TW';
}

/** Persist + change in one call. Used by all language switchers. */
export function setLanguage(lang: 'en' | 'zh-TW') {
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // SSR or blocked localStorage — ignore
  }
  void i18n.changeLanguage(lang);
}

export { LANGUAGE_KEY };

// Do NOT use `void` here — Vite/Rollup tree-shakes unhandled promise rejections
// in production, causing i18n.init() to be silently dropped. Without init,
// all namespaces (dashboard, theme, etc.) return raw keys at render time.
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
