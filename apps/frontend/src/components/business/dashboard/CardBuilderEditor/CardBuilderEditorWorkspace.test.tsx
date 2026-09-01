/**
 * CardBuilderEditorWorkspace — Vitest + RTL Tests
 *
 * L2 Standard: BackgroundUploader plan (2026-09-01) gap-fill.
 * Verifies that Step 3 renders three MediaAssetUploader sections in order:
 *   1. Logo (variant="logo")
 *   2. Icon  (variant="icon")
 *   3. Background (variant="background")
 *
 * The previous 9-phase plan completed the MediaAssetUploader 3-arm support
 * and the PassCardPreviewStrip rendering chain, but the actual Step 3 JSX
 * was missing the third (Background) section. This test guards against
 * regressions of that gap.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Track MediaAssetUploader props per render so we can assert which variants
// are mounted and in what order.
const mediaAssetUploaderProps: Array<{
  variant: string;
  templateId: string;
  showHeader: boolean;
}> = [];

vi.mock(
  './MediaAssetUploader/MediaAssetUploader',
  () => ({
    MediaAssetUploader: (props: {
      variant: string;
      templateId: string;
      showHeader?: boolean;
    }) => {
      mediaAssetUploaderProps.push({
        variant: props.variant,
        templateId: props.templateId,
        showHeader: props.showHeader ?? true,
      });
      return (
        <div data-testid={`asset-uploader-${props.variant}`}>
          {props.variant}
        </div>
      );
    },
  }),
);

// Mock cardService so the load-on-mount useEffect (edit mode) does not try
// to hit the real backend.
vi.mock('@/services/cardService', () => ({
  cardService: {
    getById: vi.fn().mockResolvedValue({
      id: 'test-template-id',
      settings: {},
    }),
    update: vi.fn().mockResolvedValue({}),
    generateUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://example.com/upload',
      key: 'test-key',
    }),
  },
}));

// Mock react-i18next: t(key) returns the key as text.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

const baseProps = {
  step: 3 as const,
  onStepChange: vi.fn(),
  cardType: 'stamp_card' as const,
  cardId: 'test-template-id',
  onCardTypeChange: vi.fn(),
};

afterEach(() => {
  mediaAssetUploaderProps.length = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CardBuilderEditorWorkspace — Step 3 (BackgroundUploader plan 2026-09-01)', () => {
  it('renders three MediaAssetUploader sections in order: logo, icon, background', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);

    // All three variants should be rendered
    expect(mediaAssetUploaderProps.map((p) => p.variant)).toEqual([
      'logo',
      'icon',
      'background',
    ]);
  });

  it('renders the Background section heading (cardEditor.step3.backgroundSection.title)', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);
    expect(screen.getByText('step3.backgroundSection.title')).toBeInTheDocument();
  });

  it('renders the Background section hint (cardEditor.step3.backgroundSection.hint)', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);
    expect(screen.getByText('step3.backgroundSection.hint')).toBeInTheDocument();
  });

  it('renders the existing Icon section heading (regression guard)', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);
    expect(screen.getByText('step3.iconSection.title')).toBeInTheDocument();
    expect(screen.getByText('step3.iconSection.hint')).toBeInTheDocument();
  });

  it('passes templateId to all three MediaAssetUploaders', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);
    for (const p of mediaAssetUploaderProps) {
      expect(p.templateId).toBe('test-template-id');
    }
  });

  it('sets showHeader={false} for icon and background (the section wrapper provides its own <h3>)', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} />);
    const iconProps = mediaAssetUploaderProps.find((p) => p.variant === 'icon');
    const backgroundProps = mediaAssetUploaderProps.find(
      (p) => p.variant === 'background',
    );
    expect(iconProps?.showHeader).toBe(false);
    expect(backgroundProps?.showHeader).toBe(false);
  });

  it('does NOT render Step 3 sections when step is not 3', () => {
    render(<CardBuilderEditorWorkspace {...baseProps} step={1} />);
    expect(mediaAssetUploaderProps).toHaveLength(0);
    expect(
      screen.queryByText('step3.backgroundSection.title'),
    ).not.toBeInTheDocument();
  });
});
