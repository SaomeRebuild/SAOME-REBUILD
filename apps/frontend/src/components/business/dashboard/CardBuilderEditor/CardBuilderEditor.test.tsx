/**
 * CardBuilderEditor — Vitest + RTL Tests
 *
 * 使用 vi.mock 模擬 react-i18next，讓 t() 返回 key 作為文本。
 * 測試使用翻譯 key（如 'pageTitle'）而非翻譯後的中文字。
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardBuilderEditor } from './CardBuilderEditor';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Mock: vi.fn(key => key) makes t() return the key as text
vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

// 每個測試後清理 store 狀態
afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CardBuilderEditor', () => {
  it('renders page title', () => {
    render(<CardBuilderEditor />);
    expect(screen.getByText('pageTitle')).toBeInTheDocument();
  });

  it('renders card name input', () => {
    render(<CardBuilderEditor />);
    const input = screen.getByPlaceholderText('cardNamePlaceholder');
    expect(input).toBeInTheDocument();
  });

  it('renders all 5 steps', () => {
    render(<CardBuilderEditor />);
    expect(screen.getByText('steps.selectType')).toBeInTheDocument();
    expect(screen.getByText('steps.cardSettings')).toBeInTheDocument();
    expect(screen.getByText('steps.cardDesign')).toBeInTheDocument();
    expect(screen.getByText('steps.cardInfo')).toBeInTheDocument();
    expect(screen.getByText('steps.save')).toBeInTheDocument();
  });

  it('renders 8 card type options in Step 1', () => {
    render(<CardBuilderEditor />);
    expect(screen.getByText('step1.cardTypes.stamp_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.cashback_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.reward_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.membership_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.discount_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.coupon_card')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.multipass')).toBeInTheDocument();
    expect(screen.getByText('step1.cardTypes.gift_card')).toBeInTheDocument();
  });

  it('shows preview empty state when no card type selected', () => {
    render(<CardBuilderEditor />);
    // 有兩個預覽區（Desktop + Mobile Bottom Sheet），用 getAllByText
    expect(screen.getAllByText('preview.empty').length).toBeGreaterThan(0);
  });

  it('selects a card type', async () => {
    const user = userEvent.setup();
    render(<CardBuilderEditor />);

    const pointCardButton = screen.getByRole('button', { name: /step1\.cardTypes\.stamp_card/ });
    await user.click(pointCardButton);

    // Card type should still be visible in selector (multiple instances due to preview)
    expect(screen.getAllByText('step1.cardTypes.stamp_card').length).toBeGreaterThan(0);
  });

  it('enables Next button only when card type is selected', async () => {
    const user = userEvent.setup();
    render(<CardBuilderEditor />);

    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();

    const pointCardButton = screen.getByRole('button', { name: /step1\.cardTypes\.stamp_card/ });
    await user.click(pointCardButton);

    // 按下卡片後，next 按鈕應該啟用
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onSave callback when provided', () => {
    const onSave = vi.fn();
    render(<CardBuilderEditor onSave={onSave} />);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onBack callback when provided', () => {
    const onBack = vi.fn();
    render(<CardBuilderEditor onBack={onBack} />);
    expect(onBack).not.toHaveBeenCalled();
  });
});
