/**
 * PassHolderHeader tests — logo src build helper + Store fallback.
 *
 * Covers the buildLogoSrc() helper (used by the render tree) and the
 * fallback icon path. Three tests pin:
 *   (a) mock absolute URL (`https://picsum...`) is passed through as-is
 *   (b) R2 key (`{tenant}/{template}/issuer-logo.png`) is wrapped with
 *       the `/api/pass-templates/:id/logo` proxy path
 *   (c) template null renders the Lucide `<Store>` fallback icon
 *
 * The full rendered `<img src>` behavior (which depends on `api.baseUrl`
 * from `env`) is covered end-to-end by `PassHolderShell.test.tsx` and the
 * smoke test; here we exercise the helper directly to pin the decision
 * rule from runs/decisions/2026-10-01-pass-templates-public-logo-proxy.md
 * § 選項 4 (Frontend URL build).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PassHolderHeader, buildLogoSrc } from './PassHolderHeader';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

// Mock react-i18next so we don't need a full i18n init in unit test.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-TW' },
  }),
}));

const sampleTemplate: PublicPassTemplate = {
  id: 'demo-cafe',
  name: 'Café Rewards',
  cardType: 'reward_card',
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  issuerLogo: 'https://picsum.photos/seed/saome-cafe/96',
};

const R2_KEY = '11111111-1111-4111-a111-111111111111/716c4244-6c63-496d-a967-6c87cdac605d/issuer-logo.png';

describe('PassHolderHeader — buildLogoSrc helper', () => {
  it('(a) mock absolute URL is passed through as-is (Q1 fix — Picsum)', () => {
    const src = buildLogoSrc('demo-cafe', 'https://picsum.photos/seed/saome-cafe/96');
    expect(src).toBe('https://picsum.photos/seed/saome-cafe/96');
  });

  it('(b) R2 key is wrapped with the public logo proxy path', () => {
    const src = buildLogoSrc('716c4244-6c63-496d-a967-6c87cdac605d', R2_KEY);
    // api.baseUrl + '/api/pass-templates/{id}/logo' (api.baseUrl from env)
    expect(src).toMatch(/\/api\/pass-templates\/716c4244-6c63-496d-a967-6c87cdac605d\/logo$/);
    // MUST NOT be the raw R2 key (which would 404 on HTTPS origin)
    expect(src).not.toBe(R2_KEY);
  });

  it('returns null when issuerLogo is undefined (consumer renders Store fallback)', () => {
    expect(buildLogoSrc('demo-cafe', undefined)).toBeNull();
    expect(buildLogoSrc('demo-cafe', '')).toBeNull();
  });
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PassHolderHeader — render', () => {
  it('(c) template null renders the Lucide <Store> fallback icon', () => {
    renderWithRouter(<PassHolderHeader template={null} />);
    const header = screen.getByTestId('pass-holder-header');
    // Lucide <Store> renders as <svg>
    expect(header.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the template logoText + issuerName when template is set', () => {
    renderWithRouter(<PassHolderHeader template={sampleTemplate} />);
    expect(screen.getByTestId('pass-holder-header-title')).toHaveTextContent('Café 咖啡');
    expect(screen.getByTestId('pass-holder-header-subtitle')).toHaveTextContent('Café Rewards Co.');
  });
});
