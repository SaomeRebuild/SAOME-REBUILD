/**
 * TemplateCardPreview.test.tsx � 4 conformance tests for UI alignment
 * with CardBuilder's right-pane PassCardPreview.
 *
 * 2026-10-05 PR � TemplateCardPreview UI ?? CardBuilder?
 *   - outer aspect ratio ? 375/600????? 375/503?
 *   - outer border ? transparent???? 200 ?????
 *   - footer divider ? transparent?????????
 *   - footer QR ??????camera readability?
 *
 * ? 4 ??? visual regression???? DOM shape???? data path?
 * ???? regress????????
 *
 * @see .cursor/plans/templatecardpreview_??_cardbuilder_*.plan.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TemplateCardPreview } from './TemplateCardPreview';
import { i18n } from '@/test/i18n';

// Mock getAccessToken to avoid coupling to the auth store.
vi.mock('@/services/authStore', () => ({
  getAccessToken: () => null,
}));

const settingsBase = {
  cardType: 'membership_card' as const,
  logoText: 'My Card',
  issuerName: 'Test Issuer',
  barcodeType: 'qr_code' as const,
  stampGridRows: 2 as const,
  stampIconId: 'bell',
  leftField: 'phone' as const,
  rightField: 'email' as const,
  language: 'zh-TW' as const,
};

function renderPreview(overrides: Record<string, unknown> = {}) {
  const settings = { ...settingsBase, ...overrides };
  return render(<TemplateCardPreview templateId="tpl-1" settings={settings as never} />);
}

beforeEach(() => {
  cleanup();
  i18n.changeLanguage('zh-TW');
});

describe('TemplateCardPreview � UI alignment with CardBuilder right pane (2026-10-05)', () => {
  /** Helper: get the outer card preview element. */
  function outerEl(): HTMLElement {
    return screen.getByTestId('template-card-preview');
  }

  it('outer aspect ratio = 375 / 600 (matches CardBuilder PassCardPreview) (regression 2026-10-05)', () => {
    // The legacy 375/503 ratio made the template thumbnail look squashed
    // and not like a real Apple Wallet pass. CardBuilder's right-pane
    // PassCardPreview uses 375/600 � same ratio must apply here so the
    // two previews have the same proportional height.
    renderPreview();
    expect(outerEl().style.aspectRatio).toBe('375 / 600');
  });

  it('outer border is `border-transparent` (no visible card outline) (regression 2026-10-05)', () => {
    // Legacy `border-neutral-200` added a visible card outline that
    // diverged from CardBuilder's `border-transparent` look. Must NOT
    // come back � defensive scan to keep the alignment locked in.
    renderPreview();
    const cls = outerEl().className;
    expect(cls).toMatch(/\bborder-transparent\b/);
    expect(cls).not.toMatch(/\bborder-neutral-200\b/);
  });

  it('footer divider is `border-transparent` (no white horizontal line) (regression 2026-10-05)', () => {
    // Real Apple Wallet passes don't have a horizontal line between the
    // body and the barcode. Legacy `border-neutral-200` rendered exactly
    // that � a visible white divider � and made the thumbnail look
    // non-physical. The fix mirrors CardBuilder's PassCardPreviewFooter
    // 2026-09-10 ?????.
    renderPreview();
    // The footer is the only direct child of the inner surface that
    // carries `border-t` (the inner surface is the `:scope > div`
    // without data-testid � same selector as innerSurfaceStyle helper).
    const root = outerEl();
    const innerSurface = root.querySelector(':scope > div:not([data-testid])') as HTMLElement | null;
    expect(innerSurface).toBeInTheDocument();
    const footer = innerSurface!.querySelector(':scope > div.border-t') as HTMLElement | null;
    expect(footer).toBeInTheDocument();
    expect(footer!.className).toMatch(/\bborder-transparent\b/);
    expect(footer!.className).not.toMatch(/\bborder-neutral-200\b/);
  });

  it('QR code is wrapped in a `bg-white` container (camera needs white background) (regression 2026-10-05)', () => {
    // Mirrors PassCardPreviewFooter: QR image must sit on a white
    // background so it's readable by phone cameras even when the card
    // surface is dark. The legacy bare `<img>` had no background and
    // could become invisible on dark cards.
    renderPreview({ barcodeType: 'qr_code' });
    const img = screen.getByAltText('QR Code');
    const wrapper = img.parentElement as HTMLElement | null;
    expect(wrapper).toBeInTheDocument();
    expect(wrapper!.className).toMatch(/\bbg-white\b/);
  });

  /**
   * 2026-10-06 — strip 內層對齊鎖定。
   *
   * User feedback：stamp / multipass / default 卡的 strip 內容被推到左邊，
   * 跟編輯器右側 `PassCardPreviewStrip.tsx` 不一致。本測試確保：
   *   - membership_card → wrapper `justify-start`（label/value 配對靠左）
   *   - 其他 cardType   → wrapper `justify-center`（icon / stamp grid 置中）
   *
   * 編輯器 source-of-truth 對齊點：`PassCardPreviewStrip.tsx` 的
   * `<div className="absolute inset-0 flex items-center justify-center">`
   * 是所有非會員 branch 的基準 wrapper。
   */
  it('strip 內層對齊：membership_card 靠左、其餘 cardType 置中 (regression 2026-10-06)', () => {
    // Stamp card → 置中
    const { rerender } = renderPreview({ cardType: 'stamp_card', stampIconId: 'bell' });
    const stampWrapper = screen
      .getByTestId('template-card-preview')
      .querySelector('.absolute.inset-0.flex') as HTMLElement | null;
    expect(stampWrapper).toBeInTheDocument();
    expect(stampWrapper!.className).toMatch(/\bitems-center\b/);
    expect(stampWrapper!.className).toMatch(/\bjustify-center\b/);
    expect(stampWrapper!.className).not.toMatch(/\bjustify-start\b/);

    // Membership card → 靠左
    rerender(
      <TemplateCardPreview
        templateId="tpl-1"
        settings={{ ...settingsBase, cardType: 'membership_card' } as never}
      />,
    );
    const membershipWrapper = screen
      .getByTestId('template-card-preview')
      .querySelector('.absolute.inset-0.flex') as HTMLElement | null;
    expect(membershipWrapper).toBeInTheDocument();
    expect(membershipWrapper!.className).toMatch(/\bitems-center\b/);
    expect(membershipWrapper!.className).toMatch(/\bjustify-start\b/);
    expect(membershipWrapper!.className).not.toMatch(/\bjustify-center\b/);
  });
});
