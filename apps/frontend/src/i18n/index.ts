import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import authZhTW from './locales/auth.zh-TW.json';
import authEn from './locales/auth.en.json';
import dashboardZhTW from './locales/dashboard.zh-TW.json';
import dashboardEn from './locales/dashboard.en.json';
import passNotificationZhTW from './locales/pass-notification.zh-TW.json';
import passNotificationEn from './locales/pass-notification.en.json';
import themeZhTW from './locales/theme.zh-TW.json';
import themeEn from './locales/theme.en.json';

const resources = {
  'zh-TW': {
    translation: zhTW,
    auth: authZhTW,
    dashboard: dashboardZhTW,
    passNotification: passNotificationZhTW,
    theme: themeZhTW,
  },
  en: {
    translation: en,
    auth: authEn,
    dashboard: dashboardEn,
    passNotification: passNotificationEn,
    theme: themeEn,
  },
};

// Do NOT use `void` here — Vite/Rollup tree-shakes unhandled promise rejections
// in production, causing i18n.init() to be silently dropped. Without init,
// all namespaces (dashboard, theme, etc.) return raw keys at render time.
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh-TW',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;