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

  it('applies custom background color', () => {
    const { container } = render(
      <PassCardPreview name="測試卡片" backgroundColor="#ff0000" />
    );
    // Find the strip element with background color
    const strip = container.querySelector('[style*="background-color"]') as HTMLElement;
    expect(strip).toBeInTheDocument();
    expect(strip.style.backgroundColor).toBe('rgb(255, 0, 0)'); // #ff0000 in rgb
  });
});
