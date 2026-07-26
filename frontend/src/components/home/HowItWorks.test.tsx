import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders section title', () => {
    render(<HowItWorks />);
    expect(screen.getByRole('heading', { level: 2, name: '4 步驟啟動您的忠誠會員計畫' })).toBeInTheDocument();
  });

  it('renders 4 steps', () => {
    const { container } = render(<HowItWorks />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards.length).toBe(4);
  });

  describe('each step', () => {
    it('renders step 1', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '註冊並建立店家資料' })).toBeInTheDocument();
    });

    it('renders step 2', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '自訂會員獎勵規則' })).toBeInTheDocument();
    });

    it('renders step 3', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '設計會員卡片模板' })).toBeInTheDocument();
    });

    it('renders step 4', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '會員立即開始集點' })).toBeInTheDocument();
    });
  });

  it('renders step icons', () => {
    const { container } = render(<HowItWorks />);
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders step containers', () => {
    const { container } = render(<HowItWorks />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards.length).toBe(4);
  });
});
