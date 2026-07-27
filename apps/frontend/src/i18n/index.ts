import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import authZhTW from './locales/auth.zh-TW.json';
import authEn from './locales/auth.en.json';

const resources = {
  'zh-TW': { translation: zhTW, auth: authZhTW },
  en: { translation: en, auth: authEn },
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