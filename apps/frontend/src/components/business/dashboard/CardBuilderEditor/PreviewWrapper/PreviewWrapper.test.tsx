/**
 * PreviewWrapper — tests for the prop-chain wiring (2026-09-04 stamp correction).
 *
 * The wrapper must forward every PassCardPreview prop, including
 * `stampGridRows` and `stampIconId`. Without this plumbing, the editor's
 * Step 3 stamp controls could mutate the store but the preview would
 * silently keep showing the default hero — exactly the bug we're fixing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { PreviewWrapper } from './PreviewWrapper';

// Mock the manifest so any stamp lookup in PassCardPreview is deterministic.
vi.mock('@/assets/icons/stamps/manifest', () => ({
  STAMP_ICONS: [
    { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' },
  ],
  STAMP_ICON_IDS: ['bell'],
  getStampIcon: (id: string) =>
    id === 'bell'
      ? { id: 'bell', stampedUrl: '/stamped/bell.png', unstampedUrl: '/unstamped/bell.png' }
      : undefined,
}));

describe('PreviewWrapper — stamp prop forwarding (2026-09-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards stampGridRows and stampIconId to PassCardPreview (PhoneFrame branch)', () => {
    // PhoneFrame branch is the default; we use the bare-card branch below
    // to bypass PhoneFrame DOM noise and assert PassCardPreview receives
    // the stamp props.
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="stamp_card"
        stampIconId="bell"
        stampGridRows={3}
        showPhoneFrame={false}
      />,
    );
    // PassCardPreview exposes the strip; the stamp grid test-id appears
    // when ALL THREE gating conditions are met (cardType + iconId + rows).
    const grid = container.querySelector('[data-testid="stamp-grid-preview"]');
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute('data-rows')).toBe('3');
  });

  it('does NOT render the stamp grid when stampIconId is empty (gating contract)', () => {
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="stamp_card"
        stampIconId=""
        stampGridRows={2}
        showPhoneFrame={false}
      />,
    );
    expect(container.querySelector('[data-testid="stamp-grid-preview"]')).toBeNull();
  });

  it('does NOT render the stamp grid for non-stamp cardType', () => {
    const { container } = render(
      <PreviewWrapper
        name="Test"
        cardType="cashback_card"
        stampIconId="bell"
        stampGridRows={2}
        showPhoneFrame={false}
      />,
    );
    expect(container.querySelector('[data-testid="stamp-grid-preview"]')).toBeNull();
  });
});
