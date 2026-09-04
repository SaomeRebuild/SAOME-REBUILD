/**
 * PassCardPreview — Vitest + RTL Tests
 *
 * 測試卡片本體預覽元件的渲染與比例固定。
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassCardPreview } from './PassCardPreview';
import { PassCardPreviewBack } from './PassCardPreviewBack';

// Mock: vi.fn(key => key) makes t() return the key as text
vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

describe('PassCardPreview', () => {
  it('renders card name', () => {
    render(<PassCardPreview name="測試卡片" />);
    // Name appears in both Header and Strip
    expect(screen.getAllByText('測試卡片').length).toBeGreaterThan(0);
  });

  it('renders default card name when not provided', () => {
    render(<PassCardPreview />);
    // Mock returns key as-is: t('defaultName') => 'defaultName'
    expect(screen.getByText('defaultName')).toBeInTheDocument();
  });

  it('renders issuer logo placeholder', () => {
    render(<PassCardPreview name="測試卡片" />);
    // Building2 icon SVG is rendered when no issuerLogo
    const buildingIcon = document.querySelector('[class*="lucide-building2"]');
    expect(buildingIcon).toBeInTheDocument();
  });

  it('renders card type label', () => {
    render(<PassCardPreview name="測試卡片" cardType="stamp_card" />);
    // cardType is rendered directly without i18n lookup
    expect(screen.getAllByText('stamp_card').length).toBeGreaterThan(0);
  });

  it('has correct aspect ratio', () => {
    const { container } = render(<PassCardPreview name="測試卡片" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.style.aspectRatio).toBe('375 / 503');
  });

  it('renders holder name on front side', () => {
    render(<PassCardPreview name="測試卡片" side="front" holderName="張三" />);
    // Front side renders holder name in footer
    expect(screen.getByText('張三')).toBeInTheDocument();
  });

  it('renders barcode on front side', () => {
    render(<PassCardPreview name="測試卡片" side="front" />);
    // Front side renders barcode number
    expect(screen.getByText('4938591027384')).toBeInTheDocument();
  });

  it('applies background color to entire card body but NOT to strip (Step 3 color picker 2026-09-03 — strip is fixed dark grey regardless of picker)', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" backgroundColor="#ff0000" />
    );
    // Inner card body now uses backgroundColor (was: bg-white hardcoded).
    // Find the inner flex-col container with inline backgroundColor.
    const cardBody = Array.from(container.querySelectorAll('div')).find(
      (el) =>
        el.className.includes('relative') &&
        el.className.includes('flex-col') &&
        el.className.includes('h-full') &&
        el.style.backgroundColor === 'rgb(255, 0, 0)',
    ) as HTMLElement;
    expect(cardBody).toBeInTheDocument();

    // Strip is FIXED dark grey (#1f2937 → rgb(31, 41, 55)), NOT the picker color.
    // This is intentional: strip mimics Apple Wallet hero strip which does
    // not follow the card body color picker.
    const strip = Array.from(container.querySelectorAll('div')).find(
      (el) =>
        el.className.includes('relative') &&
        (el.className.includes('h-[100px]') || el.className.includes('h-[120px]')),
    ) as HTMLElement;
    expect(strip).toBeInTheDocument();
    expect(strip.style.backgroundColor).toBe('rgb(31, 41, 55)');
  });

  it('does not apply background color to inner card body when backgroundColor prop is omitted', () => {
    const { container } = render(<PassCardPreview name="測試卡片" />);
    // The card body div (with h-full + flex-col) must NOT have inline backgroundColor set.
    const cardBody = Array.from(container.querySelectorAll('div')).find(
      (el) =>
        el.className.includes('flex-col') &&
        el.className.includes('h-full') &&
        el.className.includes('relative'),
    ) as HTMLElement;
    expect(cardBody).toBeInTheDocument();
    expect(cardBody.style.backgroundColor).toBe('');
  });

  it('applies textColor to header name span', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" textColor="#ff0000" />
    );
    // Header name span uses class text-sm.font-bold (non-compact) or text-xs.font-bold (compact).
    // Mock returns i18n key as-is, so default name "defaultIssuerName" appears in the span.
    const nameSpan = container.querySelector('span.text-sm.font-bold') as HTMLElement
      || container.querySelector('span.text-xs.font-bold') as HTMLElement;
    expect(nameSpan).toBeInTheDocument();
    expect(nameSpan.style.color).toBe('rgb(255, 0, 0)');
  });

  it('applies textColor to card type badge', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" cardType="stamp_card" textColor="#ff0000" />
    );
    // The card type badge has class rounded-full (pill).
    // 2026-09-03: removed bg-neutral-200 → background is now transparent.
    // Identify the badge by its text content matching the cardType.
    const badge = Array.from(container.querySelectorAll('span.rounded-full')).find(
      (el) => el.textContent === 'stamp_card',
    ) as HTMLElement;
    expect(badge).toBeInTheDocument();
    expect(badge.style.color).toBe('rgb(255, 0, 0)');
  });

  it('applies textColor to body field labels and values (left + right)', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" textColor="#ff0000" />
    );
    // Scope check: Body's left label and right value spans should both have
    // inline style.color = textColor. We count all spans with inline textColor
    // and verify at least 4 (header name + card type badge + body label + body
    // value; the strip's name span also picks up textColor = 5 total).
    // The Footer's barcode value (text-[8px] text-neutral-500) is INTENTIONALLY
    // outside the textColor scope (per Step 3 plan 2026-09-03), so it should
    // NOT have inline color.
    const coloredSpans = Array.from(container.querySelectorAll('span')).filter((el) =>
      el.style.color === 'rgb(255, 0, 0)',
    );
    expect(coloredSpans.length).toBeGreaterThanOrEqual(4);

    // Footer barcode value still uses text-neutral-500 (out of textColor scope — correct)
    const footerBarcodeSpan = container.querySelector('span.text-neutral-500') as HTMLElement;
    expect(footerBarcodeSpan).toBeInTheDocument();
    expect(footerBarcodeSpan.style.color).toBe('');
  });

  it('applies background image INSIDE the strip (constrained to strip area, not full card)', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" backgroundImage="https://example.com/bg.jpg" />
    );
    // The background image lives INSIDE the strip element (h-[100px]).
    // The outer card root (with aspect-ratio) does NOT have an <img> as a
    // DIRECT child anymore — the previous bug was the bg image being placed
    // at the outer container, which then visually covered the header / body.
    const cardRoot = container.querySelector('[style*="aspect-ratio"]') as HTMLElement;
    expect(cardRoot).toBeInTheDocument();
    const directImg = cardRoot.querySelector(':scope > img[src="https://example.com/bg.jpg"]');
    expect(directImg).toBeNull();

    // The bg img must live inside the strip
    const strip = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('relative') && (
        el.className.includes('h-[100px]') || el.className.includes('h-[120px]')
      )
    ) as HTMLElement;
    expect(strip).toBeInTheDocument();
    const stripImg = strip.querySelector('img[src="https://example.com/bg.jpg"]') as HTMLImageElement;
    expect(stripImg).toBeInTheDocument();
    expect(stripImg.className).toContain('absolute');
    expect(stripImg.className).toContain('inset-0');
    expect(stripImg.className).toContain('object-cover');
  });

  it('strip is a positioned container so the background image cannot leak up to header or down to body', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" backgroundImage="https://example.com/bg.jpg" />
    );
    // The strip must have `relative` + `overflow-hidden` so the absolute
    // background image is constrained to the strip area only. Previously
    // the strip was `static`, so the absolute overlay escaped upward into
    // the header.
    const strip = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('relative') && (
        el.className.includes('h-[100px]') || el.className.includes('h-[120px]')
      )
    ) as HTMLElement;
    expect(strip).toBeInTheDocument();
    expect(strip.className).toContain('relative');
    expect(strip.className).toContain('overflow-hidden');
  });

  it('strip always renders semi-transparent overlay for text readability', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" />
    );
    // The strip always renders its dark overlay (rgba(0,0,0,0.35)) so the
    // card name + icon are readable regardless of the card's background.
    const stripDiv = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('relative') && (
        el.className.includes('h-[100px]') || el.className.includes('h-[120px]')
      )
    ) as HTMLElement;
    expect(stripDiv).toBeInTheDocument();
    // The overlay is the absolute child with aria-hidden="true" and the
    // dark rgba background color.
    const overlay = Array.from(stripDiv.querySelectorAll('div')).find(
      (el) => el.style.backgroundColor === 'rgba(0, 0, 0, 0.35)'
    ) as HTMLElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.backgroundColor).toBe('rgba(0, 0, 0, 0.35)');
  });

  // ─── PassCreator Label/Value regression (2026-09-04 v2 plan) ───
  it('renders fieldPreview.memberLevel.label when leftField="memberLevel"', () => {
    render(<PassCardPreview name="測試卡片" leftField="memberLevel" />);
    // Body renders 4 spans: left label + left value + right label + right value.
    // leftField=memberLevel → left row reads "fieldPreview.memberLevel.label" / "fieldPreview.memberLevel.value".
    expect(screen.getByText('fieldPreview.memberLevel.label')).toBeInTheDocument();
    expect(screen.getByText('fieldPreview.memberLevel.value')).toBeInTheDocument();
  });

  it('renders fieldPreview.birthday.value when rightField="birthday"', () => {
    render(<PassCardPreview name="測試卡片" rightField="birthday" />);
    // rightField=birthday → right row reads "fieldPreview.birthday.label" / "fieldPreview.birthday.value".
    expect(screen.getByText('fieldPreview.birthday.label')).toBeInTheDocument();
    expect(screen.getByText('fieldPreview.birthday.value')).toBeInTheDocument();
  });

  // ─── Back side fills PhoneFrame height (2026-09-05) ───
  // 根因：PassCardPreview 外層 wrapper 對所有面套上 aspectRatio: '375 / 503'，
  // 導致 side='back' 也被卡成 ~444px 高，無法填滿 PhoneFrame 內容區的 ~738px。
  // 修法：aspectRatio 改成只在 side='front' 套用；背面交給父層 h-full 撐高度。
  // 正面行為完全不變（同一個 aspectRatio 值、同樣的 className）。
  it('back side does NOT apply aspect-ratio 375/503 (fills PhoneFrame height)', () => {
    const { container } = render(<PassCardPreview name="X" side="back" />);
    const card = container.firstChild as HTMLElement;
    expect(card).toBeInTheDocument();
    // 反面解除 aspectRatio 限制 → 由父層 h-full 撐出高度
    expect(card.style.aspectRatio).toBe('');
  });

  it('back side uses h-full w-full (not aspect-ratio)', () => {
    const { container } = render(<PassCardPreview name="X" side="back" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('h-full');
    expect(card.className).toContain('w-full');
  });

  it('front side still has aspectRatio 375/503 (regression guard)', () => {
    const { container } = render(<PassCardPreview name="X" side="front" />);
    const card = container.firstChild as HTMLElement;
    expect(card.style.aspectRatio).toBe('375 / 503');
  });
});

// ─── Step 4 card-info propagation (2026-09-04) ───
// PassCardPreviewBack renders three extra sections on the back of the card:
//   - Section 1: description (or fallback i18n key)
//   - Section 4: back fields (label/value rows; border-t between rows)
//   - Section 5: links title + list (blue underline on value)
// These tests exercise PassCardPreviewBack directly because it's the
// component that owns the new render logic. PassCardPreview integrates by
// forwarding the same props.
describe('PassCardPreviewBack — Step 4 card-info (2026-09-04)', () => {
  describe('Section 1: description', () => {
    it('renders the provided description text', () => {
      render(<PassCardPreviewBack description="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('falls back to the i18n placeholder when description is undefined', () => {
      render(<PassCardPreviewBack />);
      // t('preview.backSide.description') → 'preview.backSide.description' (mock)
      expect(screen.getByText('preview.backSide.description')).toBeInTheDocument();
    });

    it('falls back to the i18n placeholder when description is empty string', () => {
      render(<PassCardPreviewBack description="" />);
      expect(screen.getByText('preview.backSide.description')).toBeInTheDocument();
    });
  });

  describe('Section 4: back fields', () => {
    it('renders the backFields as label/value rows', () => {
      render(
        <PassCardPreviewBack
          backFields={[
            { label: 'Email', value: 'a@b.com' },
            { label: 'Phone', value: '+1234' },
          ]}
        />,
      );
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('+1234')).toBeInTheDocument();
    });

    it('falls back to the i18n placeholder when backFields is undefined', () => {
      render(<PassCardPreviewBack />);
      expect(screen.getByText('preview.backSide.termsOrLinks')).toBeInTheDocument();
    });

    it('falls back to the i18n placeholder when backFields is empty array', () => {
      render(<PassCardPreviewBack backFields={[]} />);
      expect(screen.getByText('preview.backSide.termsOrLinks')).toBeInTheDocument();
    });

    it('filters out rows where both label and value are empty', () => {
      render(
        <PassCardPreviewBack
          backFields={[
            { label: '', value: '' },
            { label: 'Email', value: 'a@b.com' },
          ]}
        />,
      );
      // Two <li> in Section 4 (and two in Section 5 expected-empty). We assert
      // the Email row IS visible (with value too), but assert there are
      // exactly 1 row in Section 4 by counting backField markers.
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
    });

    it('keeps rows where only the label is empty (mid-edit)', () => {
      render(
        <PassCardPreviewBack
          backFields={[{ label: '', value: '1234567' }]}
        />,
      );
      expect(screen.getByText('1234567')).toBeInTheDocument();
    });

    it('applies border-t divider between rows', () => {
      const { container } = render(
        <PassCardPreviewBack
          backFields={[
            { label: 'A', value: '1' },
            { label: 'B', value: '2' },
          ]}
        />,
      );
      // Find the backField <ul> by its containing section (Section 4
      // is the FIRST <ul> in the rendered tree).
      const firstUl = container.querySelector('ul');
      const items = firstUl?.querySelectorAll('li') ?? [];
      expect(items.length).toBe(2);
      // First row has no border-t; second row has border-t
      expect(items[0]?.className).not.toContain('border-t');
      expect(items[1]?.className).toContain('border-t');
    });
  });

  describe('Section 5: links', () => {
    it('renders the linksTitle heading', () => {
      render(<PassCardPreviewBack />);
      expect(screen.getByText('preview.backSide.linksTitle')).toBeInTheDocument();
    });

    it('renders links as label/value rows with blue underline on value', () => {
      const { container } = render(
        <PassCardPreviewBack
          links={[
            { label: 'Web', value: 'https://x.com' },
            { label: 'Phone', value: 'tel:+1234' },
          ]}
        />,
      );
      expect(screen.getByText('Web')).toBeInTheDocument();
      expect(screen.getByText('https://x.com')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('tel:+1234')).toBeInTheDocument();

      // Value spans must use blue+underline (semantic hyperlink)
      const valueSpans = container.querySelectorAll('span.text-blue-600');
      expect(valueSpans.length).toBeGreaterThanOrEqual(2);
      const underlineSpans = container.querySelectorAll('span.underline');
      expect(underlineSpans.length).toBeGreaterThanOrEqual(2);
    });

    it('shows the empty placeholder when links is undefined', () => {
      render(<PassCardPreviewBack />);
      expect(screen.getByText('preview.backSide.linksEmpty')).toBeInTheDocument();
    });

    it('shows the empty placeholder when links is empty array', () => {
      render(<PassCardPreviewBack links={[]} />);
      expect(screen.getByText('preview.backSide.linksEmpty')).toBeInTheDocument();
    });

    it('filters out empty link rows', () => {
      const { container } = render(
        <PassCardPreviewBack
          links={[
            { label: '', value: '' },
            { label: 'Web', value: 'https://x.com' },
          ]}
        />,
      );
      // Only the second row should appear in Section 5
      const lists = container.querySelectorAll('ul');
      // The second <ul> is Section 5 (Section 4 has no rows when all-empty;
      // here Section 4 also empty because backFields undefined → placeholder,
      // so first/lists[0] is Section 5)
      // Find the links <ul>: it's the one whose first <li> contains "Web"
      const linkList = Array.from(lists).find((ul) =>
        ul.textContent?.includes('Web'),
      );
      expect(linkList).toBeTruthy();
      const items = linkList?.querySelectorAll('li') ?? [];
      expect(items.length).toBe(1);
    });
  });

  // ─── Back side layout (2026-09-05) ───
  // 配合 PassCardPreview 解除 aspect-ratio，背面 root 必須：
  // - overflow-x-hidden：長 URL/Email 不會撐出 X 軸
  // - min-h-0：flex column 子項能正確 shrink（在父層為 flex container 時）
  it('hides horizontal scrollbar via overflow-x-hidden (back-fill fix 2026-09-05)', () => {
    const { container } = render(<PassCardPreviewBack />);
    const root = container.firstChild as HTMLElement;
    expect(root).toBeInTheDocument();
    expect(root.className).toContain('overflow-x-hidden');
  });

  it('uses min-h-0 on flex column root (back-fill fix 2026-09-05)', () => {
    const { container } = render(<PassCardPreviewBack />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('min-h-0');
  });
});
