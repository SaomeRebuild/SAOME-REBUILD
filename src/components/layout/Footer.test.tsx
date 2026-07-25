import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

describe('Footer', () => {
  describe('branding', () => {
    it('renders SAOME logo and slogan', () => {
      renderFooter();
      expect(screen.getByText('SAOME')).toBeInTheDocument();
      expect(screen.getByText('更多回頭的客戶=更高的營收')).toBeInTheDocument();
    });

    it('logo links to home', () => {
      renderFooter();
      const logo = screen.getByRole('link', { name: /SAOME/ });
      expect(logo).toHaveAttribute('href', '/');
    });
  });

  describe('navigation links', () => {
    it('renders footer navigation links', () => {
      renderFooter();
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveTextContent('商品細節');
      expect(nav).toHaveTextContent('演示');
      expect(nav).toHaveTextContent('詳細定價');
    });
  });

  describe('contact info', () => {
    it('renders contact email', () => {
      renderFooter();
      const emailLink = screen.getByRole('link', { name: 'hello@saome.org' });
      expect(emailLink).toHaveAttribute('href', 'mailto:hello@saome.org');
    });

    it('renders social links with aria-labels', () => {
      renderFooter();
      expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'X' })).toBeInTheDocument();
    });
  });

  describe('legal links', () => {
    it('renders privacy / terms / gdpr links', () => {
      renderFooter();
      const privacy = screen.getByRole('link', { name: '隱私權政策' });
      expect(privacy).toHaveAttribute('href', '/privacy');
      const terms = screen.getByRole('link', { name: '服務條款' });
      expect(terms).toHaveAttribute('href', '/terms');
      const gdpr = screen.getByRole('link', { name: '資料處理協議' });
      expect(gdpr).toHaveAttribute('href', '/gdpr');
    });
  });

  describe('copyright', () => {
    it('renders copyright with 2026', () => {
      renderFooter();
      expect(screen.getByText(/© 2026 SAOME/)).toBeInTheDocument();
    });
  });

  describe('payment security', () => {
    it('renders secure payments badge with Visa and Mastercard', () => {
      renderFooter();
      expect(screen.getByText('安全支付')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Mastercard' })).toBeInTheDocument();
    });
  });
});
