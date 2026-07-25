import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Features } from './Features';

describe('Features', () => {
  it('renders section with id="features" for anchor navigation', () => {
    const { container } = render(<Features />);
    const section = container.querySelector('#features');
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe('SECTION');
  });

  it('renders section title and subtitle', () => {
    render(<Features />);
    expect(screen.getByRole('heading', { level: 2, name: '為您的店家打造的完整解決方案' })).toBeInTheDocument();
    expect(screen.getByText('所有您需要的一切，幫助您發展業務')).toBeInTheDocument();
  });

  it('renders 4 feature cards', () => {
    const { container } = render(<Features />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards.length).toBe(4);
  });

  describe('each feature card', () => {
    it('renders Pass Card feature', () => {
      render(<Features />);
      expect(screen.getByRole('heading', { level: 3, name: '數位會員卡' })).toBeInTheDocument();
      expect(screen.getByText(/Apple Wallet.*Google Wallet/)).toBeInTheDocument();
    });

    it('renders Points feature', () => {
      render(<Features />);
      expect(screen.getByRole('heading', { level: 3, name: '印章與點數' })).toBeInTheDocument();
      expect(screen.getByText(/靈活的集點規則/)).toBeInTheDocument();
    });

    it('renders Scanner feature', () => {
      render(<Features />);
      expect(screen.getByRole('heading', { level: 3, name: '掃碼系統' })).toBeInTheDocument();
      expect(screen.getByText(/員工專用掃碼工具/)).toBeInTheDocument();
    });

    it('renders Multi-tenant feature', () => {
      render(<Features />);
      expect(screen.getByRole('heading', { level: 3, name: '多租戶管理' })).toBeInTheDocument();
      expect(screen.getByText(/一個平台管理多個分店/)).toBeInTheDocument();
    });
  });

  it('each card has an icon container', () => {
    const { container } = render(<Features />);
    const iconContainers = container.querySelectorAll('.bg-accent.text-on-accent');
    expect(iconContainers.length).toBe(4);
  });
});
