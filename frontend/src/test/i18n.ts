import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from '../i18n/locales/zh-TW.json';
import en from '../i18n/locales/en.json';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      'zh-TW': { translation: zhTW },
      en: { translation: en },
    },
    lng: 'zh-TW',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
