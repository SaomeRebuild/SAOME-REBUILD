import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import authZhTW from '../i18n/locales/auth.zh-TW';
import authEn from '../i18n/locales/auth.en';
import dashboardZhTW from '../i18n/locales/dashboard.zh-TW';
import dashboardEn from '../i18n/locales/dashboard.en';
import passNotificationZhTW from '../i18n/locales/passNotification.zh-TW';
import passNotificationEn from '../i18n/locales/passNotification.en';
import themeZhTW from '../i18n/locales/theme.zh-TW';
import themeEn from '../i18n/locales/theme.en';
import landingZhTW from '../i18n/locales/landing.zh-TW';
import landingEn from '../i18n/locales/landing.en';
import legalZhTW from '../i18n/locales/legal.zh-TW';
import legalEn from '../i18n/locales/legal.en';
import pricingZhTW from '../i18n/locales/pricing.zh-TW';
import pricingEn from '../i18n/locales/pricing.en';
import navZhTW from '../i18n/locales/nav.zh-TW';
import navEn from '../i18n/locales/nav.en';
import memberZhTW from '../i18n/locales/member.zh-TW';
import memberEn from '../i18n/locales/member.en';
import cardBuilderZhTW from '../i18n/locales/cardBuilder.zh-TW';
import cardBuilderEn from '../i18n/locales/cardBuilder.en';
import cardEditorZhTW from '../i18n/locales/cardEditor.zh-TW';
import cardEditorEn from '../i18n/locales/cardEditor.en';
import passCardZhTW from '../i18n/locales/passCard.zh-TW';
import passCardEn from '../i18n/locales/passCard.en';
import confirmDraftZhTW from '../i18n/locales/confirmDraft.zh-TW';
import confirmDraftEn from '../i18n/locales/confirmDraft.en';
import logoUploadZhTW from '../i18n/locales/logoUpload.zh-TW';
import logoUploadEn from '../i18n/locales/logoUpload.en';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
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
        confirmDraft: confirmDraftZhTW,
        logoUpload: logoUploadZhTW,
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
        confirmDraft: confirmDraftEn,
        logoUpload: logoUploadEn,
      },
    },
    lng: 'zh-TW',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export { i18n };
