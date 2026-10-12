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

  // ===== Step 8 v4 — Passcreator-failure banner (2026-10-11) =====
  // When the backend `updateTemplateService` throws `BadGatewayError` with
  // details.upstream === 'passcreator', the hook sets `passcreatorError`
  // so the `Step8SaveErrorBanner` can render the full error detail
  // (status code, truncated body, retry CTA, dismiss X).

  it('Passcreator BadGatewayError renders the error banner (no toast)', async () => {
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        upstreamStatus: 502,
        upstreamBody: 'upstream unavailable: passcreator rejected the request',
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // The banner is rendered.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // The retry + dismiss CTAs are present.
    expect(screen.getByTestId('step8-error-retry')).toBeInTheDocument();
    expect(screen.getByTestId('step8-error-dismiss')).toBeInTheDocument();
    // No toast — the banner IS the surface, not a fallback.
    expect(toast.error).not.toHaveBeenCalled();
    // No navigation.
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('non-Passcreator BadGatewayError renders the generic toast (no banner)', async () => {
    const otherUpstreamError = Object.assign(new Error('Some other upstream'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: { upstream: 'some-other-service', upstreamStatus: 502 },
    });
    updateSpy.mockRejectedValueOnce(otherUpstreamError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Generic toast surface (no banner — only Passcreator gets the
    // dedicated UX).
    expect(toast.error).toHaveBeenCalledWith('cardEditor:steps.save.publishError');
    expect(screen.queryByTestId('step8-error-banner')).not.toBeInTheDocument();
  });

  it('dismiss button clears the Passcreator banner', async () => {
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: { upstream: 'passcreator', upstreamStatus: 502, upstreamBody: 'oops' },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();

    // Click dismiss — banner disappears.
    await user.click(screen.getByTestId('step8-error-dismiss'));
    expect(screen.queryByTestId('step8-error-banner')).not.toBeInTheDocument();
  });

  it('Passcreator BadGatewayError with upstreamErrors renders the field error list (regression — 2026-10-11)', async () => {
    // When the backend extracts structured `errors[]` from Passcreator's
    // V2 envelope (success: false, errors: [{property, message}]), the
    // hook forwards them as `upstreamErrors` on PasscreatorSyncError.
    // The banner must render one row per `{property, message}` pair,
    // so the user sees WHICH fields are wrong without parsing raw JSON.
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        upstreamStatus: 400,
        upstreamBody: '{"success":false,"description":"The provided JSON was invalid.","errors":[...]}',
        upstreamErrors: [
          { property: 'description', message: 'The property description is required' },
          { property: 'type', message: 'The property type is required' },
        ],
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Structured field error list present.
    const fieldList = screen.getByTestId('step8-error-field-list');
    expect(fieldList).toBeInTheDocument();
    // Both rows render.
    const rows = screen.getAllByTestId('step8-error-field-row');
    expect(rows).toHaveLength(2);
    // First row contains the property and message.
    expect(rows[0]!.textContent).toContain('description');
    expect(rows[0]!.textContent).toContain('The property description is required');
    expect(rows[1]!.textContent).toContain('type');
    expect(rows[1]!.textContent).toContain('The property type is required');
  });

  it('Passcreator BadGatewayError WITHOUT upstreamErrors does NOT render the field error list (fallback to details block)', async () => {
    // When the upstream doesn't return a V2 error envelope (e.g. 5xx
    // with a generic body, 401 with empty body, 404 HTML page), the
    // backend sets no `upstreamErrors`. The banner must NOT render
    // the (empty) field list — only the raw upstreamBody details block.
    const passcreatorError = Object.assign(new Error('Passcreator unavailable'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        upstreamStatus: 502,
        upstreamBody: 'upstream unavailable',
        // no upstreamErrors field
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Field list NOT present (no upstreamErrors).
    expect(screen.queryByTestId('step8-error-field-list')).not.toBeInTheDocument();
  });

  // ===== Step 8 v5 — Passcreator `kind` discriminator (regression — 2026-10-11) =====
  // The 502 the backend throws can have 3 distinct underlying causes
  // (network / invalid_response / upstream_rejected), each requiring
  // different user-facing copy. The backend's `BadGatewayError.details.kind`
  // surfaces this discriminator; the banner must render the right copy.
  //
  // The 2026-10-11 incident: Cloudflare edge returned HTTP 530 with
  // body "error code: 1016" (Origin DNS error — can't reach Passcreator
  // origin). The banner was misleadingly saying "check your network
  // connection" — but it was Passcreator's origin that was unreachable,
  // not the user's network.

  it('kind="network" renders the network description (DNS / connection refused)', async () => {
    const passcreatorError = Object.assign(new Error('fetch failed: ECONNREFUSED'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        kind: 'network',
        // No upstreamStatus — the request never reached the wire.
        upstreamBody: 'network error: fetch failed: ECONNREFUSED',
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Description has data-kind="network" and the right i18n key.
    const desc = screen.getByTestId('step8-error-description');
    expect(desc.getAttribute('data-kind')).toBe('network');
    expect(desc.textContent).toBe('steps.save.passcreatorSyncFailed.networkDescription');
  });

  it('kind="invalid_response" renders the service-unavailable description (Cloudflare 530/1016 regression — 2026-10-11)', async () => {
    // The exact 530 + "error code: 1016" path that triggered this work.
    const passcreatorError = Object.assign(new Error('Passcreator unreachable'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        kind: 'invalid_response',
        upstreamStatus: 530,
        upstreamBody: 'non-JSON response: error code: 1016',
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Description has data-kind="invalid_response" and the right i18n key.
    // This is the "service temporarily unavailable" copy — NOT the
    // misleading "check your network connection" copy.
    const desc = screen.getByTestId('step8-error-description');
    expect(desc.getAttribute('data-kind')).toBe('invalid_response');
    expect(desc.textContent).toBe('steps.save.passcreatorSyncFailed.invalidResponseDescription');
  });

  it('kind="upstream_rejected" renders the rejected description + field error list (V2 envelope)', async () => {
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        kind: 'upstream_rejected',
        upstreamStatus: 400,
        upstreamBody: '{"success":false,"description":"...","errors":[...]}',
        upstreamErrors: [
          { property: 'description', message: 'is required' },
        ],
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Description has data-kind="upstream_rejected" and the right i18n key.
    const desc = screen.getByTestId('step8-error-description');
    expect(desc.getAttribute('data-kind')).toBe('upstream_rejected');
    expect(desc.textContent).toBe('steps.save.passcreatorSyncFailed.upstreamRejectedDescription');
    // Field error list still rendered (the actionable signal).
    expect(screen.getByTestId('step8-error-field-list')).toBeInTheDocument();
  });

  it('falls back to generic description when kind is missing (backward compat with older backend)', async () => {
    // Pre-2026-10-11 backend never set `kind`. The banner must still
    // render — using the generic description — so older deployments
    // don't show a blank banner.
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: {
        upstream: 'passcreator',
        upstreamStatus: 502,
        upstreamBody: 'oops',
        // no `kind` field
      },
    });
    updateSpy.mockRejectedValueOnce(passcreatorError);
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });

    // Banner present.
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    // Description falls back to the generic key.
    const desc = screen.getByTestId('step8-error-description');
    expect(desc.getAttribute('data-kind')).toBe('unknown');
    expect(desc.textContent).toBe('steps.save.passcreatorSyncFailed.description');
  });

  it('retry button re-triggers cardService.update with the same cardId', async () => {
    const passcreatorError = Object.assign(new Error('Passcreator rejected'), {
      code: 'BAD_GATEWAY',
      i18nKey: 'common.error.upstreamFailed',
      details: { upstream: 'passcreator', upstreamStatus: 502, upstreamBody: 'oops' },
    });
    // First call rejects (banner shows). Second call resolves (success).
    updateSpy.mockRejectedValueOnce(passcreatorError);
    updateSpy.mockResolvedValueOnce({} as never);
    const user = userEvent.setup();
    renderWithRouter();

    // First attempt — fails with Passcreator 502.
    await user.click(screen.getByTestId('step8-publish-button'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('step8-error-banner')).toBeInTheDocument();
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Click retry — second attempt succeeds.
    await user.click(screen.getByTestId('step8-error-retry'));
    await act(async () => { await Promise.resolve(); });

    // Retry calls update again with the same cardId.
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenNthCalledWith(2, 'test-template-id', { status: 'published' });
    // Successful retry navigates to Library (Auth flow 鐵律 #2).
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
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