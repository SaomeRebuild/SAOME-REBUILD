import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.ts';
import en from './locales/en.ts';
import authZhTW from './locales/auth.zh-TW.ts';
import authEn from './locales/auth.en.ts';
import dashboardZhTW from './locales/dashboard.zh-TW.ts';
import dashboardEn from './locales/dashboard.en.ts';
import passNotificationZhTW from './locales/passNotification.zh-TW.ts';
import passNotificationEn from './locales/passNotification.en.ts';
import themeZhTW from './locales/theme.zh-TW.ts';
import themeEn from './locales/theme.en.ts';
import landingZhTW from './locales/landing.zh-TW.ts';
import landingEn from './locales/landing.en.ts';
import legalZhTW from './locales/legal.zh-TW.ts';
import legalEn from './locales/legal.en.ts';
import pricingZhTW from './locales/pricing.zh-TW.ts';
import pricingEn from './locales/pricing.en.ts';
import navZhTW from './locales/nav.zh-TW.ts';
import navEn from './locales/nav.en.ts';
import memberZhTW from './locales/member.zh-TW.ts';
import memberEn from './locales/member.en.ts';

const resources = {
  'zh-TW': {
    translation: zhTW,
    auth: authZhTW,
    dashboard: dashboardZhTW,
    passNotification: passNotificationZhTW,
    theme: themeZhTW,
    landing: landingZhTW,
    legal: legalZhTW,
    pricing: pricingZhTW,
    nav: navZhTW,
    member: memberZhTW,
  },
  en: {
    translation: en,
    auth: authEn,
    dashboard: dashboardEn,
    passNotification: passNotificationEn,
    theme: themeEn,
    landing: landingEn,
    legal: legalEn,
    pricing: pricingEn,
    nav: navEn,
    member: memberEn,
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
