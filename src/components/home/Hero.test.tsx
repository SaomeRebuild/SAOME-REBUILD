import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Hero } from './Hero';

const renderHero = () =>
  render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  );

describe('Hero', () => {
  it('renders as a section element', () => {
    const { container } = renderHero();
    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
  });

  it('renders badge text', () => {
    renderHero();
    expect(screen.getByText('數位會員卡行銷計畫')).toBeInTheDocument();
  });

  it('renders main heading', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('更多回頭的客戶=更高的營收');
  });

  it('renders subtitle', () => {
    renderHero();
    expect(screen.getByText(/增加.*客戶保留率/)).toBeInTheDocument();
  });

  describe('CTA buttons', () => {
    it('renders primary CTA linking to register', () => {
      renderHero();
      const cta = screen.getByRole('link', { name: /開始免費試用/ });
      expect(cta).toHaveAttribute('href', '/register');
    });

    it('renders secondary CTA linking to demo', () => {
      renderHero();
      const cta = screen.getByRole('link', { name: /觀看示範/ });
      expect(cta).toHaveAttribute('href', '/demo');
    });
  });

  describe('visual elements', () => {
    it('renders the hero section with content', () => {
      const { container } = renderHero();
      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
    });
  });
});
