/**
 * PassHolderPassDownload Storybook stories.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderPassDownload.stories
 *
 * 2026-10-19 — initial version. Stories cover all 4 UI states the
 * main component distinguishes (success / failure-with-retry /
 * success-without-barcode / pre-launch). The Storybook meta uses
 * the `passHolder` i18n namespace and a mock template to keep the
 * canvas small.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PassHolderPassDownload } from './PassHolderPassDownload';

const TEST_TEMPLATE = {
  id: 'tmpl-1',
  name: 'Café Rewards',
  cardType: 'reward_card' as const,
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  language: 'zh-TW' as const,
};

const passHolderZhTW = {
  download: {
    title: 'Pass 已發行！',
    subtitle: '把 Pass 加入你的手機錢包，隨時出示給店員掃描（{{issuerName}}）',
    // split-two-platform-buttons (2026-10-19): the two
    // platform CTAs share these keys; the legacy appleWallet /
    // directDownload / iosHint keys are gone.
    forIos: '給 iPhone 用戶',
    forAndroid: 'Android 用戶',
    barcodeLabel: '條碼內容',
    showBarcodeHint: '櫃台掃描時請出示條碼',
    notReadyYet: 'Pass 尚未發行，請稍候再試。',
  },
  passwalletReminder: {
    title: 'Android 用戶',
    body: 'iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App。',
    installCta: '下載 Passwallet',
  },
  downloadError: {
    title: '簽發暫時無法完成',
    body: '伺服器忙碌中，請稍後重試。',
    retry: '重試簽發',
  },
  errors: {
    upstreamFailed: '簽發服務暫時無法使用',
  },
};

function withI18n<P extends object>(Story: React.ComponentType<P>) {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: 'zh-TW',
      fallbackLng: 'zh-TW',
      resources: { 'zh-TW': { passHolder: passHolderZhTW } },
      interpolation: { escapeValue: false },
    });
  }
  return (
    <I18nextProvider i18n={i18next}>
      <Story {...({} as P)} />
    </I18nextProvider>
  );
}

const meta = {
  title: 'Business/Pass/PassHolderPassDownload',
  component: PassHolderPassDownload,
  decorators: [withI18n],
  args: {
    template: TEST_TEMPLATE,
  },
} satisfies Meta<typeof PassHolderPassDownload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    template: TEST_TEMPLATE,
    issuance: {
      passIdentifier: 'abc-123',
      downloadPage: 'https://app.passcreator.com/p/abc123',
      iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
      androidUri: 'https://pay.google.com/save/abc123',
      barcodeValue: 'STATIC-BARCODE-VALUE',
      issuedAt: '2026-10-19T08:42:13.123Z',
    },
  },
};

export const SuccessWithoutBarcode: Story = {
  args: {
    template: TEST_TEMPLATE,
    issuance: {
      passIdentifier: 'abc-123',
      downloadPage: 'https://app.passcreator.com/p/abc123',
      iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
      androidUri: 'https://pay.google.com/save/abc123',
      barcodeValue: null,
      issuedAt: '2026-10-19T08:42:13.123Z',
    },
  },
};

export const FailureWithRetry: Story = {
  args: {
    template: TEST_TEMPLATE,
    issuance: { issuanceError: 'passHolder.errors.upstreamFailed' },
    onRetry: () => {
      // eslint-disable-next-line no-alert
      window.alert('Retry clicked (storybook mock)');
    },
  },
};

export const PreLaunch: Story = {
  args: {
    template: TEST_TEMPLATE,
    // issuance omitted
  },
};