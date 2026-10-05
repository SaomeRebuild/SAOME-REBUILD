/**
 * Step8Save — Vitest + RTL Integration Test (Rule 003 TDD)
 *
 * Verifies the Step 8 "Save & Publish" flow:
 *   - Renders summary + actions sub-components
 *   - Validation gate: cardType=null OR cardName='' → Publish disabled + hint shown
 *   - Publish success → cardService.update({ status: 'published' }) + navigate
 *   - Publish failure → toast.error + button re-enabled
 *   - Back button → navigate to Library without publishing
 *
 * Mirrors the Step 7 guard pattern in CardBuilderEditorWorkspace.test.tsx
 * (the 5-state machine test that pre-dated this pattern).
 *
 * @see .cursor/plans/cardbuilder_step_8_save_+_template_library_強化_90356854.plan.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Step8Save } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { toast } from '@/components/ui/feedback/Toast';

const updateSpy = vi.fn();

vi.mock('@/services/cardService', () => ({
  cardService: {
    update: (...args: unknown[]) => updateSpy(...args),
  },
}));

vi.mock('@/components/ui/feedback/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock useAuth so the hook returns a known role (tenant by default).
const mockAuthState: { user: { role: string } | null; tenant: unknown } = {
  user: { role: 'tenant' },
  tenant: null,
};
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ state: mockAuthState }),
}));

// Mock useNavigate so we can assert navigation calls without a real
// router. The MemoryRouter wrapper below provides the navigate function
// implementation via react-router-dom.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Step8Save />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState.user = { role: 'tenant' };
  // Default state: a valid draft ready to publish
  useCardBuilderStore.getState().reset();
  useCardBuilderStore.setState({
    cardId: 'test-template-id',
    cardName: 'My Test Card',
    logoText: 'My Logo',
    issuerName: 'Test Issuer',
    cardType: 'stamp_card',
    barcodeType: 'qr_code',
    locations: [],
    isPaid: false,
  });
});

afterEach(() => {
  cleanup();
});

describe('Step8Save — happy path', () => {
  it('renders summary + actions + title', () => {
    renderWithRouter();
    expect(screen.getByTestId('step8-save-summary')).toBeInTheDocument();
    expect(screen.getByTestId('step8-publish-button')).toBeInTheDocument();
    expect(screen.getByTestId('step8-back-button')).toBeInTheDocument();
    // Title i18n key (mocked t returns the key as-is)
    expect(screen.getByText('steps.save.title')).toBeInTheDocument();
  });

  it('Publish button calls cardService.update({ status: "published" }) once with the cardId', async () => {
    updateSpy.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    expect(button).not.toBeDisabled();

    await user.click(button);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
  });

  it('successful Publish navigates to Library (replace: true) per Auth flow 鐵律 #2', async () => {
    updateSpy.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });

  it('successful Publish shows success toast', async () => {
    updateSpy.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(toast.success).toHaveBeenCalledWith('cardEditor:steps.save.publishSuccess');
  });

  it('Back button navigates to Library (replace: true) without calling cardService.update', async () => {
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-back-button'));

    expect(updateSpy).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });

  it('admin role navigates to admin dashboard', async () => {
    mockAuthState.user = { role: 'admin' };
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-back-button'));

    expect(navigateMock).toHaveBeenCalledWith('/admin/dashboard', { replace: true });
  });
});

describe('Step8Save — validation gate', () => {
  it('Publish disabled when cardType is null + hint shown', () => {
    useCardBuilderStore.setState({ cardType: null });
    renderWithRouter();
    const button = screen.getByTestId('step8-publish-button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('step8-validation-hint')).toBeInTheDocument();
    expect(screen.getByTestId('step8-validation-hint').textContent).toContain(
      'steps.save.validationCardType',
    );
  });

  it('Publish disabled when cardName is empty + hint shown', () => {
    useCardBuilderStore.setState({ cardName: '' });
    renderWithRouter();
    const button = screen.getByTestId('step8-publish-button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('step8-validation-hint')).toBeInTheDocument();
    expect(screen.getByTestId('step8-validation-hint').textContent).toContain(
      'steps.save.validationName',
    );
  });

  it('Publish disabled when cardName is whitespace-only + hint shown', () => {
    useCardBuilderStore.setState({ cardName: '   ' });
    renderWithRouter();
    const button = screen.getByTestId('step8-publish-button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('step8-validation-hint')).toBeInTheDocument();
  });

  it('no validation hint when both cardType and cardName are valid', () => {
    renderWithRouter();
    expect(screen.queryByTestId('step8-validation-hint')).not.toBeInTheDocument();
  });

  it('cardType hint has priority over cardName hint when both fail', () => {
    useCardBuilderStore.setState({ cardType: null, cardName: '' });
    renderWithRouter();
    expect(screen.getByTestId('step8-validation-hint').textContent).toContain(
      'steps.save.validationCardType',
    );
  });
});

describe('Step8Save — error path', () => {
  it('cardService.update rejects → toast.error shown + button re-enabled', async () => {
    updateSpy.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    await user.click(button);

    // Flush promises from the publish() async flow
    await act(async () => {
      await Promise.resolve();
    });

    // 2026-10-06 fix — assertion on i18n key, not translated text.
    // The hook uses `i18n.t()` (per Rule 023 § hook context), and the
    // global `@/i18n` test mock makes `i18n.t()` return the key as-is.
    // Asserting on the key (not the translated text) matches the mock
    // contract and aligns with the success-toast assertion above.
    expect(toast.error).toHaveBeenCalledWith('cardEditor:steps.save.publishError');
    expect(navigateMock).not.toHaveBeenCalled();
    // After error, button re-enables (assuming validation is still valid)
    expect(button).not.toBeDisabled();
  });
});

describe('Step8Save — saving state', () => {
  it('button is disabled while saving (after click, before resolve)', async () => {
    // Make updateSpy never resolve so we can observe the saving state.
    let resolveUpdate!: () => void;
    updateSpy.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveUpdate = () => resolve({});
        }),
    );

    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    expect(button).not.toBeDisabled();

    await user.click(button);
    // While the promise is pending, status should be 'saving'
    expect(button).toBeDisabled();

    // Cleanup: resolve to avoid leaking the pending promise.
    resolveUpdate();
  });
});

describe('Step8Save — summary values from store', () => {
  it('renders summary with current store values', () => {
    useCardBuilderStore.setState({
      cardName: 'My Card',
      cardType: 'membership_card',
      issuerName: 'Test Issuer',
      barcodeType: 'pdf_417',
      issuerLogo: 'tenant-1/template-1/logo.png',
      locations: [
        { name: 'X', latitude: 25, longitude: 121, relevantText: null },
      ],
      isPaid: true,
    });
    renderWithRouter();
    const summary = screen.getByTestId('step8-save-summary');
    // Verify the cardType label renders the i18n key (mocked t returns key)
    expect(summary.textContent).toContain('step1.cardTypes.membership_card');
    expect(summary.textContent).toContain('step2.barcode.pdf417');
  });

  it('renders — as placeholder when cardName or issuerName is empty', () => {
    useCardBuilderStore.setState({ cardName: '', issuerName: '' });
    renderWithRouter();
    const summary = screen.getByTestId('step8-save-summary');
    // Two em-dash placeholders (cardName + issuerName)
    const dashes = summary.textContent?.match(/—/g) ?? [];
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});