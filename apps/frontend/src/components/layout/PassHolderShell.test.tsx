/**
 * PassHolderShell tests — header + main + footer wiring + slot rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PassHolderShell } from './PassHolderShell';

// Mock react-i18next with a translator that just echoes the key (the
// header delegates translation to the consumer so the shell itself does
// not need i18n state — but PassHolderHeader does use useTranslation).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-TW' },
  }),
}));

import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

const sampleTemplate: PublicPassTemplate = {
  id: 'demo-cafe',
  name: 'Café Rewards',
  cardType: 'reward_card',
  logoText: 'Café 咖啡',
  issuerName: 'Café Rewards Co.',
  issuerLogo: 'https://example.test/logo.png',
  language: 'en',
};

// DashboardFooter renders a react-router-dom <Link>, so the shell tests
// need a Router context.
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PassHolderShell', () => {
  it('renders header + main + footer', () => {
    renderWithRouter(
      <PassHolderShell template={sampleTemplate}>
        <div data-testid="child">child content</div>
      </PassHolderShell>,
    );
    expect(screen.getByTestId('pass-holder-header')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-footer-copyright')).toBeInTheDocument();
  });

  it('passes the template to the header (logo + subtitle render)', () => {
    renderWithRouter(
      <PassHolderShell template={sampleTemplate}>
        <span>body</span>
      </PassHolderShell>,
    );
    expect(screen.getByTestId('pass-holder-header-title')).toHaveTextContent('Café 咖啡');
    expect(screen.getByTestId('pass-holder-header-subtitle')).toHaveTextContent('Café Rewards Co.');
  });

  it('falls back to the default Store icon when no issuerLogo is set', () => {
    renderWithRouter(
      <PassHolderShell template={{ ...sampleTemplate, issuerLogo: undefined }}>
        <span>body</span>
      </PassHolderShell>,
    );
    // The Lucide <Store> renders an <svg> inside the logo container.
    const header = screen.getByTestId('pass-holder-header');
    expect(header.querySelector('svg')).toBeInTheDocument();
  });

  it('renders children inside <main>', () => {
    renderWithRouter(
      <PassHolderShell template={sampleTemplate}>
        <p data-testid="main-child">in main</p>
      </PassHolderShell>,
    );
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.contains(screen.getByTestId('main-child'))).toBe(true);
  });

  it('tolerates a null template during loading', () => {
    renderWithRouter(
      <PassHolderShell template={null}>
        <span>still mounts</span>
      </PassHolderShell>,
    );
    expect(screen.getByTestId('pass-holder-header')).toBeInTheDocument();
  });
});
