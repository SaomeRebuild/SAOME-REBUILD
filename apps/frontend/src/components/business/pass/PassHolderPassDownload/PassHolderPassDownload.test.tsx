/**
 * PassHolderPassDownload tests — render the L2 view in 5 distinct
 * states to pin the contract.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderPassDownload.test
 *
 * Covers:
 *   1. Success path: download CTA + barcode display + Android reminder
 *      all visible.
 *   2. Failure path: error banner visible, download CTA hidden.
 *   3. No barcode: download CTA visible but barcode display hidden.
 *   4. Pre-launch: no issuance → "not ready yet" copy, no CTA.
 *   5. Retry button: when `onRetry` provided, clicking it fires the
 *      callback.
 *
 * The i18n hook is exercised with the real translation function via
 * the i18nForTest helper (mirrors `apps/frontend/src/test/i18n.ts`).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PassHolderPassDownload } from './PassHolderPassDownload';
import type { PassHolderPassDownloadProps } from './PassHolderPassDownload.types';

// 2026-10-19 — minimal i18n setup mirroring the test helper used by
// other L2 components. We don't import the workspace-level helper
// directly because it's a `.ts` file that exports a configured instance;
// creating a local instance keeps the test self-contained.
const TEST_TEMPLATE = {
  id: 'tmpl-1',
  name: 'Café Rewards',
  cardType: 'reward_card' as const,
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  language: 'zh-TW' as const,
};

function renderWithI18n(props: PassHolderPassDownloadProps) {
  // Per-test setup — initialize once via vi.spyOn guard so multiple
  // renders in the same describe don't re-init.
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: 'zh-TW',
      fallbackLng: 'zh-TW',
      resources: {
        'zh-TW': {
          passHolder: {
            download: {
              title: 'Pass 已發行！',
              subtitle: '把 Pass 加入你的手機錢包，隨時出示給店員掃描（{{issuerName}}）',
              appleWallet: '加入 Apple 錢包',
              directDownload: '下載 .pkpass',
              iosHint: 'iPhone 用戶可直接加入 Apple 錢包',
              barcodeLabel: '條碼內容',
              showBarcodeHint: '櫃台掃描時請出示條碼',
              notReadyYet: 'Pass 尚未發行，請稍候再試。',
            },
            passwalletReminder: {
              title: 'Android 用戶',
              body: 'iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App，再點上方「下載 .pkpass」開啟。',
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
          },
        },
      },
      interpolation: { escapeValue: false },
    });
  }
  return render(
    <I18nextProvider i18n={i18next}>
      <PassHolderPassDownload {...props} />
    </I18nextProvider>,
  );
}

describe('PassHolderPassDownload', () => {
  it('success path: download CTA + barcode + Android reminder all render', () => {
    // V3 contract (2026-10-19 fix): three URIs in the issuance payload
    // — `downloadPage` (universal), `iPhoneUri` (.pkpass direct),
    // `androidUri` (Google Wallet). The CTA's href is picked by
    // `pickDownloadUri()` based on user-agent; jsdom default UA
    // matches none of iOS / Android regex → falls through to
    // `downloadPage`. So the test asserts `downloadPage` is the href.
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        downloadPage: 'https://app.passcreator.com/p/abc123',
        iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
        androidUri: 'https://pay.google.com/save/abc123',
        barcodeValue: 'STATIC-BARCODE-VALUE',
        issuedAt: '2026-10-19T08:42:13.123Z',
      },
    });
    expect(screen.getByTestId('pass-holder-download')).toBeInTheDocument();
    // Primary CTA — jsdom UA is desktop, so the picker falls through
    // to `downloadPage` (universal landing page).
    expect(
      screen.getByTestId('pass-holder-download-cta-tmpl-1'),
    ).toHaveAttribute('href', 'https://app.passcreator.com/p/abc123');
    // Secondary CTA — same href as primary (universal link).
    expect(
      screen.getByTestId('pass-holder-download-direct'),
    ).toHaveAttribute('href', 'https://app.passcreator.com/p/abc123');
    // Barcode value rendered
    expect(screen.getByTestId('pass-holder-barcode-value')).toHaveTextContent(
      'STATIC-BARCODE-VALUE',
    );
    // Android reminder
    expect(screen.getByTestId('pass-holder-android-reminder')).toBeInTheDocument();
    // Passwallet install CTA
    expect(screen.getByTestId('pass-holder-passwallet-cta')).toHaveAttribute(
      'href',
      expect.stringContaining('passwallet'),
    );
  });

  it('iOS user-agent picks iPhoneUri (.pkpass) for the CTA href', () => {
    // Stub jsdom's userAgent to simulate an iPhone Safari visit. The
    // `pickDownloadUri()` helper should pick `iPhoneUri` over the
    // universal `downloadPage`.
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    try {
      renderWithI18n({
        template: TEST_TEMPLATE,
        issuance: {
          passIdentifier: 'abc-123',
          downloadPage: 'https://app.passcreator.com/p/abc123',
          iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
          androidUri: 'https://pay.google.com/save/abc123',
          issuedAt: '2026-10-19T08:42:13.123Z',
        },
      });
      expect(
        screen.getByTestId('pass-holder-download-cta-tmpl-1'),
      ).toHaveAttribute('href', 'https://app.passcreator.com/abc123.pkpass');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    }
  });

  it('Android user-agent picks androidUri (Google Wallet) for the CTA href', () => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });
    try {
      renderWithI18n({
        template: TEST_TEMPLATE,
        issuance: {
          passIdentifier: 'abc-123',
          downloadPage: 'https://app.passcreator.com/p/abc123',
          iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
          androidUri: 'https://pay.google.com/save/abc123',
          issuedAt: '2026-10-19T08:42:13.123Z',
        },
      });
      expect(
        screen.getByTestId('pass-holder-download-cta-tmpl-1'),
      ).toHaveAttribute('href', 'https://pay.google.com/save/abc123');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    }
  });

  it('falls back to downloadPage when platform-specific URI is missing', () => {
    // Backend returned only the universal URL (older template that
    // didn't populate `iPhoneUri` / `androidUri` in V3). On iOS we
    // should still have a working CTA via the universal fallback.
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    try {
      renderWithI18n({
        template: TEST_TEMPLATE,
        issuance: {
          passIdentifier: 'abc-123',
          downloadPage: 'https://app.passcreator.com/p/abc123',
          issuedAt: '2026-10-19T08:42:13.123Z',
        },
      });
      // iPhone UA → would prefer iPhoneUri, but it's missing → fall
      // through to downloadPage.
      expect(
        screen.getByTestId('pass-holder-download-cta-tmpl-1'),
      ).toHaveAttribute('href', 'https://app.passcreator.com/p/abc123');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    }
  });

  it('renders no CTA when all three URIs are missing (defensive)', () => {
    // If the backend succeeded but returned no URI (shouldn't happen
    // per V3 contract, but be defensive), we hide the CTA entirely
    // — the "not ready yet" copy surfaces in the parent.
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        barcodeValue: 'STATIC-BARCODE-VALUE',
        issuedAt: '2026-10-19T08:42:13.123Z',
        // downloadPage / iPhoneUri / androidUri all missing
      },
    });
    expect(screen.queryByTestId('pass-holder-download-cta-tmpl-1')).toBeNull();
  });

  it('failure path: error banner visible, download CTA hidden', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: { issuanceError: 'passHolder.errors.upstreamFailed' },
    });
    expect(screen.getByTestId('pass-holder-download-error')).toBeInTheDocument();
    // CTA must NOT render when there's an error.
    expect(screen.queryByTestId('pass-holder-download-cta-tmpl-1')).toBeNull();
    // No barcode display either.
    expect(screen.queryByTestId('pass-holder-barcode-display')).toBeNull();
  });

  it('failure path: retry button fires onRetry callback when provided', () => {
    const onRetry = vi.fn();
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: { issuanceError: 'passHolder.errors.upstreamFailed' },
      onRetry,
    });
    fireEvent.click(screen.getByTestId('pass-holder-download-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('success without barcode: CTA visible, barcode display hidden', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        downloadPage: 'https://app.passcreator.com/p/abc123',
        iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
        barcodeValue: null,
        issuedAt: '2026-10-19T08:42:13.123Z',
      },
    });
    expect(
      screen.getByTestId('pass-holder-download-cta-tmpl-1'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-barcode-display')).toBeNull();
  });

  it('pre-launch: no issuance → "not ready yet" copy, no CTA', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      // issuance omitted — template not yet pushed to Passcreator
    });
    expect(screen.getByTestId('pass-holder-download-not-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-download-cta-tmpl-1')).toBeNull();
    expect(screen.queryByTestId('pass-holder-download-error')).toBeNull();
  });
});