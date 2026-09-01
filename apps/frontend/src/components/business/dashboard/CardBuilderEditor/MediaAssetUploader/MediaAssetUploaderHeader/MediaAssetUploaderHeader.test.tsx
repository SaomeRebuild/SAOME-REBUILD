/**
 * MediaAssetUploaderHeader — Tests for the title + description renderer.
 *
 * Covers:
 * - Renders title (h3 with correct font-family token + variant-specific text)
 * - Renders description when provided
 * - Hides description when not provided (no empty <p> tag)
 * - Forwards className to the wrapper
 * - Stable data-testid for parent-level queries
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaAssetUploaderHeader } from './MediaAssetUploaderHeader';

describe('MediaAssetUploaderHeader', () => {
  it('renders the title as an h3 with the heading font-family token', () => {
    render(<MediaAssetUploaderHeader title="上傳 Logo" description="說明文字" />);

    const heading = screen.getByRole('heading', { level: 3, name: '上傳 Logo' });
    expect(heading).toBeInTheDocument();
    expect(heading.style.fontFamily).toBe('var(--font-family-heading)');
    expect(heading).toHaveClass('text-base', 'font-semibold', 'text-foreground');
  });

  it('renders the description below the title when provided', () => {
    render(
      <MediaAssetUploaderHeader
        title="上傳 Icon"
        description="Icon 會被裁切為正方形（720×720 像素），用於推播通知"
      />,
    );

    const description = screen.getByText(/Icon 會被裁切為正方形/);
    expect(description).toBeInTheDocument();
    expect(description.tagName).toBe('P');
    expect(description).toHaveClass('text-sm', 'text-muted-foreground');
  });

  it('hides the description paragraph when not provided', () => {
    render(<MediaAssetUploaderHeader title="上傳 Logo" />);

    // Title is rendered
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    // No <p> elements inside the header wrapper
    const wrapper = screen.getByTestId('asset-uploader-header');
    expect(wrapper.querySelector('p')).toBeNull();
  });

  it('renders nothing inside the wrapper besides title + optional description', () => {
    const { container } = render(
      <MediaAssetUploaderHeader title="上傳 Logo" description="說明" />,
    );

    const wrapper = screen.getByTestId('asset-uploader-header');
    expect(wrapper.children).toHaveLength(2);
    expect(wrapper.children[0]?.tagName).toBe('H3');
    expect(wrapper.children[1]?.tagName).toBe('P');

    // Sanity: no extraneous <div> wrappers inside
    expect(container.querySelectorAll('div').length).toBe(1);
  });

  it('forwards className to the outer wrapper', () => {
    render(
      <MediaAssetUploaderHeader
        title="上傳 Logo"
        description="說明"
        className="custom-class"
      />,
    );

    const wrapper = screen.getByTestId('asset-uploader-header');
    expect(wrapper).toHaveClass('custom-class');
    // Default layout classes still present (left-aligned to match sibling section headings).
    expect(wrapper).toHaveClass('flex', 'flex-col', 'items-start');
  });
});
