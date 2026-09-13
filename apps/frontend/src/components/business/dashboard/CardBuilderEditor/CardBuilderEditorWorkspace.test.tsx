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

// Mock Step4CardInfo so its internal sub-components don't leak into these
// validation-focused tests. The mocked component just renders a marker so
// we can still observe the parent's `disabled` state on the Next button.
vi.mock('./Step4CardInfo/Step4CardInfo', () => ({
  Step4CardInfo: () => <div data-testid="step4-cardinfo-mock" />,
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

describe('CardBuilderEditorWorkspace — isStep4Valid membership_card bypass (2026-09-13)', () => {
  /**
   * Plan: membership_card_conditional_ui_hide (2026-09-13).
   *
   * `isStep4Valid()` is the gate for the Step 4 "下一步" button. When
   * cardType === 'membership_card', the BackFieldsField is hidden (the
   * user cannot fill it in), so the validator must skip the backFields
   * check — otherwise the user would be stuck on Step 4 because the
   * default backFields row is `[{ label: '', value: '' }]`, which fails
   * the "value non-empty" rule.
   *
   * Approach: render the workspace at step 4, set the store state,
   * then assert the disabled state of the Next button. The Step4CardInfo
   * sub-tree is mocked away (see top-of-file) so only the validation
   * logic matters here.
   */

  beforeEach(() => {
    useCardBuilderStore.getState().reset();
  });

  it('enables the Next button for membership_card when description is filled (backFields default empty is OK)', () => {
    useCardBuilderStore.setState({
      cardType: 'membership_card',
      description: 'Hello',
      // backFields stays at the reset default [{ label: '', value: '' }].
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'membership_card' as const }}
      />,
    );
    // The Next button has the i18n text "step1.next" (translated by mock
    // as the key path).
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).not.toBeDisabled();
  });

  it('still requires description for membership_card (regression — description is always required)', () => {
    useCardBuilderStore.setState({
      cardType: 'membership_card',
      description: '',
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'membership_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();
  });

  it('still requires valid backFields for stamp_card (regression — non-membership cards still enforce)', () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      description: 'Hello',
      // backFields stays at reset default [{ label: '', value: '' }].
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'stamp_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();
  });

  it('still requires valid backFields for reward_card (regression guard)', () => {
    useCardBuilderStore.setState({
      cardType: 'reward_card',
      description: 'Hello',
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'reward_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();
  });

  it('still requires valid backFields for cashback_card (regression guard)', () => {
    useCardBuilderStore.setState({
      cardType: 'cashback_card',
      description: 'Hello',
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'cashback_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();
  });

  it('enables Next for stamp_card when description + backFields are valid (regression)', () => {
    useCardBuilderStore.setState({
      cardType: 'stamp_card',
      description: 'Hello',
      backFields: [{ label: 'Phone', value: '02-1234-5678' }],
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'stamp_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).not.toBeDisabled();
  });

  it('enables Next for membership_card even when backFields has empty value (the bypass)', () => {
    useCardBuilderStore.setState({
      cardType: 'membership_card',
      description: 'Hello',
      // Explicit empty-value backFields row — would fail for non-membership.
      backFields: [{ label: '', value: '' }],
    });
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 4 as const, cardType: 'membership_card' as const }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).not.toBeDisabled();
  });
});
