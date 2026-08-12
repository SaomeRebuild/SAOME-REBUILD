import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from '../i18n/locales/zh-TW.ts';
import en from '../i18n/locales/en.ts';
import authZhTW from '../i18n/locales/auth.zh-TW.ts';
import authEn from '../i18n/locales/auth.en.ts';
import dashboardZhTW from '../i18n/locales/dashboard.zh-TW.ts';
import dashboardEn from '../i18n/locales/dashboard.en.ts';
import passNotificationZhTW from '../i18n/locales/passNotification.zh-TW.ts';
import passNotificationEn from '../i18n/locales/passNotification.en.ts';
import themeZhTW from '../i18n/locales/theme.zh-TW.ts';
import themeEn from '../i18n/locales/theme.en.ts';
import landingZhTW from '../i18n/locales/landing.zh-TW.ts';
import landingEn from '../i18n/locales/landing.en.ts';
import legalZhTW from '../i18n/locales/legal.zh-TW.ts';
import legalEn from '../i18n/locales/legal.en.ts';
import pricingZhTW from '../i18n/locales/pricing.zh-TW.ts';
import pricingEn from '../i18n/locales/pricing.en.ts';
import navZhTW from '../i18n/locales/nav.zh-TW.ts';
import navEn from '../i18n/locales/nav.en.ts';
import memberZhTW from '../i18n/locales/member.zh-TW.ts';
import memberEn from '../i18n/locales/member.en.ts';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
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
    },
    lng: 'zh-TW',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
