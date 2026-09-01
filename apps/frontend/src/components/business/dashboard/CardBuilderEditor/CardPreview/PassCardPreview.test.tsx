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

  it('applies background color to strip (h-[100px] hero area, not body)', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" backgroundColor="#ff0000" />
    );
    // After the fix, backgroundColor is applied to the strip element
    // (h-[100px] hero area), NOT to the inner card body or the outer card root.
    // Find the strip by its className signature (relative + h-[100px]).
    const strip = Array.from(container.querySelectorAll('div')).find(
      (el) => el.className.includes('relative') && (
        el.className.includes('h-[100px]') || el.className.includes('h-[120px]')
      )
    ) as HTMLElement;
    expect(strip).toBeInTheDocument();
    expect(strip.style.backgroundColor).toBe('rgb(255, 0, 0)');
    // The outer card root must NOT carry the backgroundColor directly
    const cardRoot = container.querySelector('[style*="aspect-ratio"]') as HTMLElement;
    expect(cardRoot.style.backgroundColor || '').not.toBe('rgb(255, 0, 0)');
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
});
