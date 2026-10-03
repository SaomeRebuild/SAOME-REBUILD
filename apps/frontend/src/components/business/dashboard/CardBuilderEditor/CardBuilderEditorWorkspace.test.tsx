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

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

// 2026-10-04 PR — Mock Step7TableCard to avoid pulling Konva into unit
// tests. The mocked component just renders a marker; the workspace's
// validation logic (isStep7Valid) only reads from the Zustand store, so
// the canvas itself doesn't need to mount.
vi.mock('./Step7TableCard', () => ({
  Step7TableCard: () => <div data-testid="step7-tablecard-mock" />,
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

/**
 * Step 7 客製化桌牌 — 防呆守門 (2026-10-04 PR).
 *
 * isStep7Valid() 規則:
 *   - tableCardExportState === 'ready'   → 通過 (已成功生成)
 *   - tableCardExportState === 'stale'   → 通過 (已成功過, 後來畫布又改了)
 *   - tableCardExportState === 'idle'    → 阻擋 (使用者沒按過)
 *   - tableCardExportState === 'generating' → 阻擋 (race 避免放行)
 *   - tableCardExportState === 'error'   → 阻擋 (上次失敗, 必須重試)
 *
 * 「下一步」按鈕:
 *   - disabled 時紅字警示「請先按上方「生成桌牌」按鈕生成一次桌牌, 才能進入下一步」
 *   - enabled 時不顯示警示 (避免多餘雜訊)
 *
 * 為什麼不是「stale 也擋下」? 理由見 isStep7Valid() 註解:
 *   - stale 意味著「桌牌存在, 但畫布後續又改了」, 不影響「桌牌存在」這個事實
 *   - 使用者可能刻意保留舊桌牌 (例如店家先印這批, 內部另有設計)
 *   - 對齊 Phase 5.16 store 既有 invariant: stale = 可下載
 */
describe('CardBuilderEditorWorkspace — Step 7 防呆 (2026-10-04 PR)', () => {
  beforeEach(() => {
    useCardBuilderStore.getState().reset();
  });

  // 5 個 export 狀態 × 預期結果的對照
  const step7ExportStateCases: Array<{
    label: string;
    tableCardExportState:
      | 'idle'
      | 'generating'
      | 'ready'
      | 'stale'
      | 'error';
    shouldBlock: boolean;
  }> = [
    { label: 'idle (從未按過)', tableCardExportState: 'idle', shouldBlock: true },
    { label: 'generating (POST 進行中)', tableCardExportState: 'generating', shouldBlock: true },
    { label: 'ready (已成功生成)', tableCardExportState: 'ready', shouldBlock: false },
    { label: 'stale (已成功過, 畫布又改了)', tableCardExportState: 'stale', shouldBlock: false },
    { label: 'error (上次失敗, 必須重試)', tableCardExportState: 'error', shouldBlock: true },
  ];

  it.each(step7ExportStateCases)(
    '$label → 對應 disabled 狀態 (shouldBlock=$shouldBlock)',
    ({ tableCardExportState, shouldBlock }) => {
      useCardBuilderStore.setState({ tableCardExportState });
      render(<CardBuilderEditorWorkspace {...{ ...baseProps, step: 7 as const }} />);
      const nextButton = screen.getByRole('button', { name: /step1\.next/ });
      if (shouldBlock) {
        expect(nextButton).toBeDisabled();
      } else {
        expect(nextButton).not.toBeDisabled();
      }
    },
  );

  it('disabled 時顯示紅字提示 (step7Guard.mustGenerateFirst i18n key)', () => {
    useCardBuilderStore.setState({ tableCardExportState: 'idle' });
    render(<CardBuilderEditorWorkspace {...{ ...baseProps, step: 7 as const }} />);
    // i18n mock returns the key path. The component uses
    // t('step7Guard.mustGenerateFirst', { ns: 'tableCard' }) which becomes
    // 'step7Guard.mustGenerateFirst' in the test environment.
    expect(
      screen.getByText('step7Guard.mustGenerateFirst'),
    ).toBeInTheDocument();
  });

  it('enabled 時 (ready) 隱藏提示文字 (避免多餘雜訊)', () => {
    useCardBuilderStore.setState({ tableCardExportState: 'ready' });
    render(<CardBuilderEditorWorkspace {...{ ...baseProps, step: 7 as const }} />);
    expect(
      screen.queryByText('step7Guard.mustGenerateFirst'),
    ).not.toBeInTheDocument();
  });

  it('enabled 時 (stale) 隱藏提示文字 (對齊既有 invariant: stale 可下載)', () => {
    useCardBuilderStore.setState({ tableCardExportState: 'stale' });
    render(<CardBuilderEditorWorkspace {...{ ...baseProps, step: 7 as const }} />);
    expect(
      screen.queryByText('step7Guard.mustGenerateFirst'),
    ).not.toBeInTheDocument();
  });

  it('handleNext 不會前進 step (從 step 7 點「下一步」但 exportState=idle)', () => {
    // 重要: 點 Next 不會 onStepChange, 即使按鈕理論上被 disabled
    // 擋住 (UI 上按不到)。這是 defense-in-depth — 防止某些情境下
    // button 仍可被點擊 (例如瀏覽器 dev tools 強制 enabled).
    useCardBuilderStore.setState({ tableCardExportState: 'idle' });
    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 7 as const, onStepChange }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    // button 是 disabled, fireEvent.click 不會觸發 onClick handler
    fireEvent.click(nextButton);
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it('handleNext 在 exportState=ready 時正常前進到 step 8', () => {
    useCardBuilderStore.setState({ tableCardExportState: 'ready' });
    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 7 as const, onStepChange }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    fireEvent.click(nextButton);
    expect(onStepChange).toHaveBeenCalledWith(8);
  });

  it('handleNext 在 exportState=stale 時正常前進到 step 8 (使用者已證明會用桌牌)', () => {
    // 防止「stale 也阻擋」回歸 — 一旦使用者成功生成過, 就算後續畫布
    // 改了, 也應該能前進。「重新生成」按鈕已提示 stale 狀態, 使用者
    // 可自行決定是否要保留舊桌牌或重新生成。
    useCardBuilderStore.setState({ tableCardExportState: 'stale' });
    const onStepChange = vi.fn();
    render(
      <CardBuilderEditorWorkspace
        {...{ ...baseProps, step: 7 as const, onStepChange }}
      />,
    );
    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    fireEvent.click(nextButton);
    expect(onStepChange).toHaveBeenCalledWith(8);
  });
});
