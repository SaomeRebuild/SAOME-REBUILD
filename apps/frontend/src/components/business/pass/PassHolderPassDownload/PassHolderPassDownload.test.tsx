/**
 * PassHolderPassDownload tests — render the L2 view in distinct
 * states to pin the contract.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderPassDownload.test
 *
 * Covers:
 *   1. Success path: BOTH iOS + Android download CTAs + barcode +
 *      Android reminder all visible (split-two-platform-buttons).
 *   2. Failure path: error banner visible, download CTAs hidden.
 *   3. No barcode: download CTAs visible but barcode display hidden.
 *   4. Pre-launch: no issuance → "not ready yet" copy, no CTAs.
 *   5. Retry button: when `onRetry` provided, clicking it fires the
 *      callback.
 *   6. Lost-data fallback: contact-support banner INSTEAD of CTAs.
 *   7. Press-scale visual: anchors have `active:scale-[0.97]` +
 *      `transition-all` classes (regression for "buttons feel
 *      static" UX feedback).
 *
 * The i18n hook is exercised with the real translation function via
 * an inline i18next instance (mirrors `apps/frontend/src/test/i18n.ts`).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PassHolderPassDownload } from './PassHolderPassDownload';
import type { PassHolderPassDownloadProps } from './PassHolderPassDownload.types';

const TEST_TEMPLATE = {
  id: 'tmpl-1',
  name: 'Café Rewards',
  cardType: 'reward_card' as const,
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  language: 'zh-TW' as const,
};

/**
 * V3 fixtures used across the success-path tests.
 *
 * `downloadPage` is the universal fallback (Passcreator's landing
 * page that does server-side device sniffing); `iPhoneUri` /
 * `androidUri` are the per-platform direct links V3 returns.
 */
const FULL_V3_ISSUANCE = {
  passIdentifier: 'abc-123',
  downloadPage: 'https://app.passcreator.com/p/abc123',
  iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
  androidUri: 'https://pay.google.com/save/abc123',
  barcodeValue: 'STATIC-BARCODE-VALUE',
  issuedAt: '2026-10-19T08:42:13.123Z',
};

function renderWithI18n(props: PassHolderPassDownloadProps) {
  // Per-test setup — initialize once via the isInitialized guard so
  // multiple renders in the same describe don't re-init.
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      lng: 'zh-TW',
      fallbackLng: 'zh-TW',
      resources: {
        'zh-TW': {
          passHolder: {
            download: {
              title: 'Pass 已發行！',
              subtitle:
                '把 Pass 加入你的手機錢包，隨時出示給店員掃描（{{issuerName}}）',
              // split-two-platform-buttons (2026-10-19): the two
              // platform CTAs share these two keys; the legacy
              // appleWallet / androidWallet / directDownload / iosHint
              // keys are gone.
              forIos: '給 iPhone 用戶',
              forAndroid: 'Android 用戶',
              barcodeLabel: '條碼內容',
              showBarcodeHint: '櫃台掃描時請出示條碼',
              notReadyYet: 'Pass 尚未發行，請稍候再試。',
            },
            passwalletReminder: {
              title: 'Android 用戶',
              body: 'iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App，再點上方「Android 用戶」開啟。',
              installCta: '下載 Passwallet',
            },
            downloadError: {
              title: '簽發暫時無法完成',
              body: '伺服器忙碌中，請稍後重試。',
              retry: '重試簽發',
            },
            lostData: {
              title: '您的 Pass 缺少部分資訊',
              body: '此筆 Pass 的某些欄位因系統異常而遺失，請聯絡客服協助重新簽發。我們仍可保留您的條碼內容。',
              contactCta: '聯絡客服',
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
  // =====================================================================
  // 2026-10-19 — split-two-platform-buttons: BOTH iOS + Android CTAs
  // always render in the success path (regardless of UA). The
  // user picks the right one for their device; we no longer use
  // user-agent to gate which button shows.
  // =====================================================================
  it('success path: BOTH iOS + Android CTAs + barcode + Android reminder all render', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: FULL_V3_ISSUANCE,
    });
    expect(screen.getByTestId('pass-holder-download')).toBeInTheDocument();

    // Both anchors render with stable per-platform testids.
    const iosCta = screen.getByTestId('pass-holder-download-cta-ios-tmpl-1');
    const androidCta = screen.getByTestId(
      'pass-holder-download-cta-android-tmpl-1',
    );

    // Each anchor uses its own native URI (no UA gating).
    expect(iosCta).toHaveAttribute(
      'href',
      'https://app.passcreator.com/abc123.pkpass',
    );
    expect(androidCta).toHaveAttribute(
      'href',
      'https://pay.google.com/save/abc123',
    );

    // Each anchor carries the new i18n label (not the legacy keys).
    expect(iosCta).toHaveTextContent('給 iPhone 用戶');
    expect(androidCta).toHaveTextContent('Android 用戶');

    // Each anchor exposes an SVG icon (lucide-react).
    expect(iosCta.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
    expect(androidCta.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);

    // Both open in a new tab with no opener / referrer leak.
    expect(iosCta).toHaveAttribute('target', '_blank');
    expect(iosCta).toHaveAttribute('rel', 'noopener noreferrer');
    expect(androidCta).toHaveAttribute('target', '_blank');
    expect(androidCta).toHaveAttribute('rel', 'noopener noreferrer');

    // Barcode value rendered.
    expect(screen.getByTestId('pass-holder-barcode-value')).toHaveTextContent(
      'STATIC-BARCODE-VALUE',
    );

    // Android reminder surfaces — mentions "Passwallet" so the user
    // knows which app to install before tapping the Android button.
    expect(screen.getByTestId('pass-holder-android-reminder')).toBeInTheDocument();
    const reminder = screen.getByTestId('pass-holder-android-reminder');
    expect(reminder.textContent).toMatch(/Passwallet/);
    expect(screen.getByTestId('pass-holder-passwallet-cta')).toHaveAttribute(
      'href',
      expect.stringContaining('passwallet'),
    );
  });

  // =====================================================================
  // 2026-10-19 — split-two-platform-buttons (regression for
  // production "both buttons point to the same URL, user can't
  // tell which to use" UX bug). When `iPhoneUri` is missing,
  // the iOS button MUST fall back to `downloadPage` (universal
  // landing) — it does NOT disappear, because the user might
  // still be on iOS and want to grab the .pkpass via the
  // device-sniffing landing page. The button's LABEL stays
  // "For iOS" / "給 iPhone 用戶" regardless of which URI is set.
  // =====================================================================
  it('iPhoneUri missing → iOS button falls back to downloadPage, label stays "給 iPhone 用戶"', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        downloadPage: 'https://app.passcreator.com/p/abc123',
        // iPhoneUri intentionally missing
        androidUri: 'https://pay.google.com/save/abc123',
        issuedAt: '2026-10-19T08:42:13.123Z',
      },
    });
    const iosCta = screen.getByTestId('pass-holder-download-cta-ios-tmpl-1');
    // href MUST fall back to downloadPage (universal).
    expect(iosCta).toHaveAttribute(
      'href',
      'https://app.passcreator.com/p/abc123',
    );
    // Label MUST stay the iOS key (NOT the Android / generic one).
    expect(iosCta).toHaveTextContent('給 iPhone 用戶');

    // Android button still uses its native URI independently.
    const androidCta = screen.getByTestId(
      'pass-holder-download-cta-android-tmpl-1',
    );
    expect(androidCta).toHaveAttribute(
      'href',
      'https://pay.google.com/save/abc123',
    );
  });

  it('androidUri missing → Android button falls back to downloadPage, label stays "Android 用戶"', () => {
    // Mirror of the iOS-fallback test: Android URI missing, but the
    // Android CTA still renders using the universal landing page so
    // users on Android who reach this page still have a working CTA.
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        downloadPage: 'https://app.passcreator.com/p/abc123',
        iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
        // androidUri intentionally missing
        issuedAt: '2026-10-19T08:42:13.123Z',
      },
    });
    const androidCta = screen.getByTestId(
      'pass-holder-download-cta-android-tmpl-1',
    );
    expect(androidCta).toHaveAttribute(
      'href',
      'https://app.passcreator.com/p/abc123',
    );
    expect(androidCta).toHaveTextContent('Android 用戶');

    const iosCta = screen.getByTestId('pass-holder-download-cta-ios-tmpl-1');
    expect(iosCta).toHaveAttribute(
      'href',
      'https://app.passcreator.com/abc123.pkpass',
    );
  });

  // =====================================================================
  // 2026-10-19 — split-two-platform-buttons (regression: NO
  // user-agent gating). Before this refactor the component read
  // `navigator.userAgent` to decide which ONE button to show. This
  // test pins the contract that BOTH buttons render regardless of
  // UA — including on a desktop browser, where the user might be
  // registering on behalf of a friend / family member using a
  // different device.
  // =====================================================================
  it('BOTH CTAs render on every user-agent (regression — no UA gating)', () => {
    const originalUA = navigator.userAgent;
    // Stub an iPhone UA — historically the component would have
    // hidden the Android button.
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    try {
      renderWithI18n({
        template: TEST_TEMPLATE,
        issuance: FULL_V3_ISSUANCE,
      });
      // BOTH anchors present — user picks the platform, not the
      // component.
      expect(
        screen.getByTestId('pass-holder-download-cta-ios-tmpl-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('pass-holder-download-cta-android-tmpl-1'),
      ).toBeInTheDocument();
      // jsdom default UA: replaced above; iOS user agent doesn't
      // affect the layout.
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    }
  });

  // =====================================================================
  // 2026-10-19 — split-two-platform-buttons: defensive branch. When
  // V3 returns no URI at all (older template, or V3 still in
  // flight), BOTH buttons hide. The parent `PassHolderPassDownload`
  // already short-circuits this branch via the `hasAnyUri` flag, but
  // the component defensively returns `null` here too.
  // =====================================================================
  it('renders no CTA when all three URIs are missing (defensive) — BOTH buttons absent', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        barcodeValue: 'STATIC-BARCODE-VALUE',
        issuedAt: '2026-10-19T08:42:13.123Z',
        // downloadPage / iPhoneUri / androidUri all missing
      },
    });
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeNull();
    // The buttons container itself also absent in this branch (the
    // component returns null before rendering).
    expect(screen.queryByTestId('pass-holder-download-buttons')).toBeNull();
  });

  it('renders only Android CTA when only androidUri is set (iOS button hidden)', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        androidUri: 'https://pay.google.com/save/abc123',
        issuedAt: '2026-10-19T08:42:13.123Z',
        // downloadPage / iPhoneUri missing
      },
    });
    // Only the Android CTA renders — no downloadPage fallback.
    expect(
      screen.getByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toHaveAttribute('href', 'https://pay.google.com/save/abc123');
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeNull();
  });

  it('renders only iOS CTA when only iPhoneUri is set (Android button hidden)', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        passIdentifier: 'abc-123',
        iPhoneUri: 'https://app.passcreator.com/abc123.pkpass',
        issuedAt: '2026-10-19T08:42:13.123Z',
        // downloadPage / androidUri missing
      },
    });
    expect(
      screen.getByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toHaveAttribute('href', 'https://app.passcreator.com/abc123.pkpass');
    expect(
      screen.queryByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeNull();
  });

  // =====================================================================
  // 2026-10-19 — press-scale + brightness visual feedback (regression
  // for "buttons feel static" UX feedback). Both anchors must carry
  // the press-feedback class string — locks the design so a future
  // refactor can't quietly drop the tactile feel.
  // =====================================================================
  it('both anchors have press-scale + brightness + transition-all classes (visual feedback regression)', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: FULL_V3_ISSUANCE,
    });
    for (const cta of [
      screen.getByTestId('pass-holder-download-cta-ios-tmpl-1'),
      screen.getByTestId('pass-holder-download-cta-android-tmpl-1'),
    ]) {
      const cls = cta.className;
      // transition + hover + active + focus-visible together form
      // the press-feedback design. Any one of them missing = silent
      // regression to "static button" UX.
      expect(cls).toMatch(/transition-all/);
      expect(cls).toMatch(/duration-150/);
      expect(cls).toMatch(/hover:brightness-110/);
      expect(cls).toMatch(/active:scale-\[0\.97\]/);
      expect(cls).toMatch(/active:brightness-90/);
      expect(cls).toMatch(/focus-visible:ring-2/);
      expect(cls).toMatch(/focus-visible:ring-offset-2/);
    }
  });

  // =====================================================================
  // Pre-existing failure / pre-launch / lost-data branches — kept
  // verbatim from the prior test file (the split-two-platform-buttons
  // refactor only changes the success-path CTA structure, not the
  // error / waiting branches).
  // =====================================================================
  it('failure path: error banner visible, BOTH download CTAs hidden', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: { issuanceError: 'passHolder.errors.upstreamFailed' },
    });
    expect(screen.getByTestId('pass-holder-download-error')).toBeInTheDocument();
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeNull();
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

  it('success without barcode: both CTAs visible, barcode display hidden', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        ...FULL_V3_ISSUANCE,
        barcodeValue: null,
      },
    });
    expect(
      screen.getByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-barcode-display')).toBeNull();
  });

  it('pre-launch: no issuance → "not ready yet" copy, no CTAs', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      // issuance omitted — template not yet pushed to Passcreator
    });
    expect(screen.getByTestId('pass-holder-download-not-ready')).toBeInTheDocument();
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeNull();
    expect(screen.queryByTestId('pass-holder-download-error')).toBeNull();
  });

  // =====================================================================
  // Lost-data fallback (regression — production row
  // `83d3139a-c3bb-4806-8900-5e9b759d0122`). Pre-COALESCE-fix era:
  // barcodeValue set + 0 URIs → contact-support banner, NOT the
  // pre-launch "not ready yet" copy.
  // =====================================================================
  it('lost-data fallback: barcodeValue set + 0 URIs → contact-support banner, NOT "not ready" copy', () => {
    renderWithI18n({
      template: TEST_TEMPLATE,
      issuance: {
        barcodeValue: 'PRESERVED-BARCODE-83d3139a',
      },
    });
    expect(screen.getByTestId('pass-holder-download-lost-data')).toBeInTheDocument();
    const cta = screen.getByTestId('pass-holder-download-lost-data-cta');
    expect(cta).toHaveAttribute('href', 'mailto:support@saome.org');
    expect(screen.getByTestId('pass-holder-barcode-value')).toHaveTextContent(
      'PRESERVED-BARCODE-83d3139a',
    );
    expect(screen.queryByTestId('pass-holder-download-not-ready')).toBeNull();
    expect(
      screen.queryByTestId('pass-holder-download-cta-ios-tmpl-1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('pass-holder-download-cta-android-tmpl-1'),
    ).toBeNull();
  });

  it('lost-data fallback: custom supportEmail on template routes mailto correctly', () => {
    renderWithI18n({
      template: { ...TEST_TEMPLATE, supportEmail: 'support@cafe.example.com' } as typeof TEST_TEMPLATE & {
        supportEmail: string;
      },
      issuance: {
        barcodeValue: 'PRESERVED-BARCODE-XYZ',
      },
    });
    const cta = screen.getByTestId('pass-holder-download-lost-data-cta');
    expect(cta).toHaveAttribute('href', 'mailto:support@cafe.example.com');
  });
});
