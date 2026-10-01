/**
 * PassHolderRegistrationPage tests — covers URL param handling, loading,
 * loaded, not-found, and error states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderRegistrationPage } from './PassHolderRegistrationPage';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';
import { PassHolderError, PassHolderNotFoundError } from '@/services/passHolderService';
import appI18n from '@/i18n';

const mockGetTemplate = vi.fn();

vi.mock('@/services/passHolderService', () => {
  class PassHolderError extends Error {
    i18nKey: string;
    params?: Record<string, string | number>;
    constructor(i18nKey: string, params?: Record<string, string | number>) {
      super(i18nKey);
      this.i18nKey = i18nKey;
      this.params = params;
    }
  }
  class PassHolderNotFoundError extends PassHolderError {
    constructor(id?: string) {
      super('passHolder.errors.templateNotFound', id ? { id } : undefined);
      this.name = 'PassHolderNotFoundError';
    }
  }
  return {
    passHolderService: {
      getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
      register: vi.fn(),
    },
    PassHolderError,
    PassHolderNotFoundError,
  };
});

const sampleTemplate: PublicPassTemplate = {
  id: 'demo-cafe',
  name: 'Café Rewards',
  cardType: 'reward_card',
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  language: 'en',
};

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/pass" element={<PassHolderRegistrationPage />} />
          <Route path="/pass/:templateId" element={<PassHolderRegistrationPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockGetTemplate.mockReset();
  // Reset i18n language between tests — applyPageLanguage() flips the
  // language in-memory and the change otherwise leaks into subsequent tests,
  // breaking the Chinese-text assertions below.
  void appI18n.changeLanguage('zh-TW');
});

describe('PassHolderRegistrationPage', () => {
  it('shows a loading skeleton initially', () => {
    mockGetTemplate.mockReturnValue(new Promise(() => {})); // never resolves
    renderAt('/pass/demo-cafe');
    expect(screen.getByTestId('pass-holder-loading')).toBeInTheDocument();
  });

  it('renders the form once the template loads', async () => {
    mockGetTemplate.mockResolvedValue(sampleTemplate);
    renderAt('/pass/demo-cafe');
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-registration')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pass-holder-name')).toBeInTheDocument();
  });

  it('shows the not-found Coming Soon card when getTemplate rejects with the not-found key', async () => {
    mockGetTemplate.mockRejectedValue(new PassHolderNotFoundError('missing'));
    renderAt('/pass/missing');
    await waitFor(() => {
      expect(screen.getByText('找不到此模板，可能已下架')).toBeInTheDocument();
    });
  });

  it('shows the network error Coming Soon card for other rejections', async () => {
    mockGetTemplate.mockRejectedValue(new PassHolderError('passHolder.errors.networkError'));
    renderAt('/pass/demo-cafe');
    await waitFor(() => {
      expect(screen.getByText('網路錯誤，請稍後重試')).toBeInTheDocument();
    });
  });

  it('shows not-found when no templateId is provided', async () => {
    mockGetTemplate.mockResolvedValue(sampleTemplate);
    renderAt('/pass');
    await waitFor(() => {
      expect(screen.getByText('找不到此模板，可能已下架')).toBeInTheDocument();
    });
    // Guard: ensure we never fired the service with an undefined id.
    expect(mockGetTemplate).not.toHaveBeenCalled();
  });

  it('passes the correct templateId to the service', async () => {
    mockGetTemplate.mockResolvedValue(sampleTemplate);
    renderAt('/pass/demo-cafe');
    await waitFor(() => {
      expect(mockGetTemplate).toHaveBeenCalledWith('demo-cafe');
    });
  });

  // ================================================================
  // Q1 (2026-10-01): route pattern clarification
  // ================================================================
  //
  // React Router v6: the route definition `/pass/:templateId` uses `:` as
  // a PATTERN marker, not a URL character. A visitor opens:
  //   - `/pass/<uuid>`           → matches, renders the form
  //   - `/pass/:<uuid>` (literal colon prefix) → does not match any
  //     defined route in real browser; in MemoryRouter it parses as
  //     templateId=':<uuid>', which fails the service lookup → not-found.
  //
  // These two tests pin that behavior down so future refactors do not
  // accidentally "fix" the URL prefix and break the contract.

  it('Q1: matches /pass/{uuid} (no colon prefix) and renders the form', async () => {
    mockGetTemplate.mockResolvedValue(sampleTemplate);
    renderAt('/pass/716c4244-6c63-496d-a967-6c87cdac605d');
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-registration')).toBeInTheDocument();
    });
    expect(mockGetTemplate).toHaveBeenCalledWith(
      '716c4244-6c63-496d-a967-6c87cdac605d',
    );
  });

  it('Q1: shows not-found for /pass/:abc (literal colon prefix in URL — user confusion case)', async () => {
    // In MemoryRouter, ':abc' is a single segment and the `:templateId`
    // pattern matches any single segment, so templateId becomes ':abc'.
    // That value is not a valid UUID; the service rejects with
    // PassHolderNotFoundError and the page renders the not-found view.
    // (In real-browser navigation, the URL would simply not match any
    // route; either way the visitor sees "template not found".)
    mockGetTemplate.mockRejectedValue(new PassHolderNotFoundError(':abc'));
    renderAt('/pass/:abc');
    await waitFor(() => {
      expect(screen.getByText('找不到此模板，可能已下架')).toBeInTheDocument();
    });
    expect(mockGetTemplate).toHaveBeenCalledWith(':abc');
  });

  // ================================================================
  // Q2 (2026-10-01): template.language drives page i18n
  // ================================================================
  //
  // When the public page loads a template, it must call
  // `applyPageLanguage(template.language)` so the page renders in the
  // template's chosen language. `applyPageLanguage` is intentionally
  // distinct from `setLanguage` — it does NOT persist to localStorage,
  // so a visitor's authenticated preference (when they later log in to
  // the dashboard) is unaffected by the public-page visit.

  it('Q2: calls applyPageLanguage(template.language) on successful load', async () => {
    const i18nModule = await import('@/i18n');
    const spy = vi.spyOn(i18nModule, 'applyPageLanguage');
    mockGetTemplate.mockResolvedValue(sampleTemplate); // language: 'en'
    renderAt('/pass/demo-cafe');
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-registration')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledWith('en');
    spy.mockRestore();
  });

  it('Q2: does NOT persist template language to localStorage', async () => {
    localStorage.removeItem('saome.lang');
    mockGetTemplate.mockResolvedValue(sampleTemplate); // language: 'en'
    renderAt('/pass/demo-cafe');
    await waitFor(() => {
      expect(screen.getByTestId('pass-holder-registration')).toBeInTheDocument();
    });
    // localStorage must remain untouched — the visitor's authenticated
    // preferences are not affected by browsing a public template page.
    expect(localStorage.getItem('saome.lang')).toBeNull();
  });
});