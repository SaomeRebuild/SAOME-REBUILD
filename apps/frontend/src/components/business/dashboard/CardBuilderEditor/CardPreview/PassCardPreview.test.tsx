/**
 * PassCardPreview — Vitest + RTL Tests
 *
 * 測試卡片本體預覽元件的渲染與比例固定。
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassCardPreview } from './PassCardPreview';

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
});
