/**
 * CardBuilderEditorPreview — store → PreviewWrapper → PassCardPreview plumbing.
 *
 * 2026-09-04 stamp correction:
 *   CardBuilderEditorPreview is the right-hand column that shows the live
 *   card preview while editing. It must extract `stampGridRows` and
 *   `stampIconId` from the Zustand store and forward them through
 *   PreviewWrapper so the stamp grid actually shows up in the preview
 *   when the user picks a stamp card type + icon.
 *
 *   Without this test, a future refactor could "simplify" the destructure
 *   and silently drop the stamp props — the strip would keep rendering the
 *   default CreditCard + name hero even when stampGridRows/stampIconId are
 *   set in the store. This file locks the wiring down.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Mock the auth store / api so the background-image URL assembly doesn't blow up.
vi.mock('@/services/authStore', () => ({
  getAccessToken: vi.fn(() => 'mock-token'),
}));

vi.mock('@/config/api', () => ({
  api: {
    baseUrl: 'https://example.test',
    paths: {
      cardImage: (id: string, type: string) => `/api/cards/${id}/image/${type}`,
    },
  },
}));

// Mock react-i18next so t() returns the key.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock the stamp icon manifest so any PassCardPreview stamp lookup is deterministic.
vi.mock('@/assets/icons/stamps/manifest', () => ({
  STAMP_ICONS: [
    { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
    { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' },
  ],
  STAMP_ICON_IDS: ['bell', 'fire'],
  getStampIcon: (id: string) =>
    id === 'bell'
      ? { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' }
      : id === 'fire'
        ? { id: 'fire', stampedUrl: '/stamped/fire.png', unstampedUrl: '/unstamped/fire.png' }
        : undefined,
}));

describe('CardBuilderEditorPreview — store → preview plumbing (2026-09-04)', () => {
  beforeEach(() => {
    // Reset store to a clean stamp_card state with icon + rows set, so the
    // preview MUST render the StampGridPreview test-id (otherwise the wiring
    // is broken).
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      stampGridRows: 2,
      stampIconId: 'bell',
      cardId: null,
      backgroundImage: '',
    });
  });

  it('renders StampGridPreview in the preview when stampGridRows + stampIconId are set in the store', () => {
    render(<CardBuilderEditorPreview cardSide="front" />);
    // The strip's stamp grid test-id must appear (proves the props flowed
    // through CardBuilderEditorPreview → PreviewWrapper → PassCardPreview).
    expect(screen.getByTestId('stamp-grid-preview')).toBeInTheDocument();
    expect(screen.getByTestId('stamp-grid-preview').getAttribute('data-rows')).toBe('2');
  });

  it('falls back to default hero when stampIconId is empty (gating stays intact)', () => {
    useCardBuilderStore.setState({ stampIconId: '' });
    render(<CardBuilderEditorPreview cardSide="front" />);
    expect(screen.queryByTestId('stamp-grid-preview')).toBeNull();
  });

  it('falls back to default hero when stampGridRows is undefined (gating stays intact)', () => {
    useCardBuilderStore.setState({ stampGridRows: 1, stampIconId: '' });
    render(<CardBuilderEditorPreview cardSide="front" />);
    expect(screen.queryByTestId('stamp-grid-preview')).toBeNull();
  });

  it('also wires stamp state for multipass cardType', () => {
    useCardBuilderStore.setState({
      cardType: 'multipass',
      stampGridRows: 3,
      stampIconId: 'fire',
    });
    render(<CardBuilderEditorPreview cardSide="front" />);
    expect(screen.getByTestId('stamp-grid-preview')).toBeInTheDocument();
    expect(screen.getByTestId('stamp-grid-preview').getAttribute('data-rows')).toBe('3');
  });

  it('does NOT render StampGridPreview for non-stamp cardType even when icon + rows are set', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      stampGridRows: 2,
      stampIconId: 'bell',
    });
    render(<CardBuilderEditorPreview cardSide="front" />);
    expect(screen.queryByTestId('stamp-grid-preview')).toBeNull();
  });
});
