/**
 * Preview — Tests for the load-error fallback (Bug-φ fix).
 *
 * Phase 3 of icon-preview plan 2026-08-31: the previous Preview had NO
 * onError handler, so a broken `<img src>` would render a cryptic
 * broken-image glyph with no diagnostic. The fix replaces the broken
 * glyph with an actionable fallback: an "image failed to load" message
 * + a re-upload button. This mirrors the recovery pattern from the
 * original LogoUploader (click to re-upload if the image is gone).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Preview } from './Preview';

describe('Preview — load-error fallback (Bug-φ fix)', () => {
  const defaultProps = {
    displayUrl: 'https://example.com/uploaded-image.png',
    showSuccessBadge: false,
    replaceLabel: 'Replace',
    successLabel: 'Success',
    loadErrorLabel: 'Failed to load',
    onReplace: vi.fn(),
  };

  it('renders the <img> by default with no error state', () => {
    render(<Preview {...defaultProps} />);
    const img = screen.getByTestId('asset-preview-img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('https://example.com/uploaded-image.png');
    // load-error fallback should NOT be visible
    expect(screen.queryByTestId('asset-load-error')).not.toBeInTheDocument();
  });

  it('falls back to loadError UI when <img> fails to load', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<Preview {...defaultProps} displayUrl="https://broken.example.com/missing.png" />);
    const img = screen.getByTestId('asset-preview-img');

    // Simulate a broken image
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByTestId('asset-load-error')).toBeInTheDocument();
    });

    // The loadError label is rendered inside the fallback
    const fallback = screen.getByTestId('asset-load-error');
    expect(fallback).toHaveTextContent('Failed to load');
    // The image is no longer rendered (replaced by the fallback)
    expect(screen.queryByTestId('asset-preview-img')).not.toBeInTheDocument();
    // Success badge is suppressed when load error is shown
    expect(screen.queryByTestId('success-badge')).not.toBeInTheDocument();

    // Console error logged for DevTools triage
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MediaAssetUploader.Preview]'),
      expect.stringContaining('https://broken.example.com/missing.png'),
    );
    consoleErrorSpy.mockRestore();
  });

  it('still calls onReplace when user clicks the replace button after load error', () => {
    const onReplace = vi.fn();
    render(
      <Preview
        {...defaultProps}
        displayUrl="https://broken.example.com/missing.png"
        onReplace={onReplace}
      />,
    );
    fireEvent.error(screen.getByTestId('asset-preview-img'));

    const replaceButton = screen.getByTestId('replace-button');
    fireEvent.click(replaceButton);
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it('recovers if the image loads successfully after a previous error', async () => {
    // First render with a broken URL → trigger error
    const { rerender } = render(
      <Preview {...defaultProps} displayUrl="https://broken.example.com/missing.png" />,
    );
    fireEvent.error(screen.getByTestId('asset-preview-img'));
    await waitFor(() => {
      expect(screen.getByTestId('asset-load-error')).toBeInTheDocument();
    });

    // Force a fresh render by unmounting + remounting with a working URL.
    // (Component state is local, so we use this approach rather than rerender
    //  which would preserve the stale loadError state.)
    rerender(<div data-testid="parent" />);
    expect(screen.queryByTestId('asset-load-error')).not.toBeInTheDocument();

    rerender(
      <div data-testid="parent">
        <Preview {...defaultProps} displayUrl="https://ok.example.com/working.png" />
      </div>,
    );
    // Fresh mount: loadError is false → <img> is rendered
    expect(screen.getByTestId('asset-preview-img')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-load-error')).not.toBeInTheDocument();
  });
});
