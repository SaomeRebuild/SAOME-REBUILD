import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import authZhTW from './locales/auth.zh-TW.json';
import authEn from './locales/auth.en.json';
import dashboardZhTW from './locales/dashboard.zh-TW.json';
import dashboardEn from './locales/dashboard.en.json';

const resources = {
  'zh-TW': {
    translation: zhTW,
    auth: authZhTW,
    dashboard: dashboardZhTW,
  },
  en: {
    translation: en,
    auth: authEn,
    dashboard: dashboardEn,
  },
};

void i18n
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