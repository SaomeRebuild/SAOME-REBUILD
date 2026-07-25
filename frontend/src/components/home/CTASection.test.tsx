import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CTASection } from './CTASection';

const renderCTA = () =>
  render(
    <MemoryRouter>
      <CTASection />
    </MemoryRouter>,
  );

describe('CTASection', () => {
  it('renders CTA title', () => {
    renderCTA();
    expect(screen.getByRole('heading', { level: 2, name: '準備好提升會員參與度了嗎？' })).toBeInTheDocument();
  });

  it('renders subtitle with 14-day trial info', () => {
    renderCTA();
    expect(screen.getByText(/14 天免費試用/)).toBeInTheDocument();
    expect(screen.getByText(/無需信用卡/)).toBeInTheDocument();
  });

  it('renders CTA button linking to register', () => {
    renderCTA();
    const cta = screen.getByRole('link', { name: /開始免費試用/ });
    expect(cta).toHaveAttribute('href', '/register');
  });

  it('renders as a section element', () => {
    const { container } = renderCTA();
    expect(container.querySelector('section')).toBeInTheDocument();
  });
});
