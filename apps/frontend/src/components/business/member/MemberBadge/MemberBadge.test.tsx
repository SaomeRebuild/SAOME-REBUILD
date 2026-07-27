import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemberBadge } from './MemberBadge';
import type { MemberTier } from '@saome/shared/schemas/member';

describe('MemberBadge', () => {
  describe('顯示不同等級', () => {
    it('顯示金牌會員', () => {
      render(<MemberBadge tier="gold" />);
      expect(screen.getByText('金牌')).toBeInTheDocument();
    });

    it('顯示銀牌會員', () => {
      render(<MemberBadge tier="silver" />);
      expect(screen.getByText('銀牌')).toBeInTheDocument();
    });

    it('顯示銅牌會員', () => {
      render(<MemberBadge tier="bronze" />);
      expect(screen.getByText('銅牌')).toBeInTheDocument();
    });
  });

  describe('無障礙', () => {
    it('使用語意化標籤', () => {
      const { container } = render(<MemberBadge tier="gold" />);
      expect(container.querySelector('[data-testid="member-badge"]')).toBeInTheDocument();
    });

    it('包含 aria-label', () => {
      render(<MemberBadge tier="gold" />);
      expect(screen.getByLabelText('會員等級：金牌')).toBeInTheDocument();
    });
  });

  describe('i18n', () => {
    it('使用正確的 tier 文字', () => {
      const { rerender } = render(<MemberBadge tier="gold" />);
      expect(screen.getByText('金牌')).toBeInTheDocument();
      
      rerender(<MemberBadge tier="silver" />);
      expect(screen.getByText('銀牌')).toBeInTheDocument();
    });
  });
});
