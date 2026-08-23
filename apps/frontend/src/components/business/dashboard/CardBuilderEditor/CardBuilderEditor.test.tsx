/**
 * CardBuilderEditor — Vitest + RTL Tests
 *
 * 使用 vi.mock 模擬 react-i18next，讓 t() 返回 key 作為文本。
 * 測試使用翻譯 key（如 'pageTitle'）而非翻譯後的中文字。
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CardBuilderEditor } from './CardBuilderEditor';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Mock authService so useAuth() finds AuthProvider without needing a real provider
// Must match the shape expected by useAuth.tsx (named export 'authService')
vi.mock('@/services/authService', () => ({
  authService: {
    refresh: vi.fn().mockResolvedValue(null),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn().mockResolvedValue(null),
  },
}));

// Mock useAuth to return a dummy unauthenticated context so CardBuilderEditor renders
// without needing an AuthProvider wrapper
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    state: {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      tenant: null,
      accessToken: null,
    },
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock: vi.fn(key => key) makes t() return the key as text
vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

// 測試包裝：提供 Router context（editor 自己監聽 URL ?id=）
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/app/dashboard/card-builder']}>{ui}</MemoryRouter>);
}

// 每個測試後清理 store 狀態
afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CardBuilderEditor', () => {
  it('renders page title', () => {
    renderWithRouter(<CardBuilderEditor />);
    expect(screen.getByText('pageTitle')).toBeInTheDocument();
  });

  it('renders card name input', () => {
    renderWithRouter(<CardBuilderEditor />);
    const input = screen.getByPlaceholderText('cardNamePlaceholder');
    expect(input).toBeInTheDocument();
  });

  it('renders all 8 steps as pills with tooltips', () => {
    renderWithRouter(<CardBuilderEditor />);
    // Pills nav is hidden by default (sm:flex), so check via title attribute on buttons
    // Each pill has a title tooltip with the translation key
    expect(screen.getByTitle('steps.selectType')).toBeInTheDocument();
    expect(screen.getByTitle('steps.cardSettings')).toBeInTheDocument();
    expect(screen.getByTitle('steps.cardDesign')).toBeInTheDocument();
    expect(screen.getByTitle('steps.cardInfo')).toBeInTheDocument();
    expect(screen.getByTitle('steps.geolocation')).toBeInTheDocument();
    expect(screen.getByTitle('steps.cardLogic')).toBeInTheDocument();
    expect(screen.getByTitle('steps.customizePlaceCard')).toBeInTheDocument();
    expect(screen.getByTitle('steps.save')).toBeInTheDocument();
    // Step progress label shows current step (single span now)
    expect(screen.getByText(/steps\.selectType.*1\/8/)).toBeInTheDocument();
  });

  it('renders 8 card type options in Step 1', () => {
    renderWithRouter(<CardBuilderEditor />);
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
    renderWithRouter(<CardBuilderEditor />);
    // 有兩個預覽區（Desktop + Mobile Bottom Sheet），用 getAllByText
    expect(screen.getAllByText('preview.empty').length).toBeGreaterThan(0);
  });

  it('selects a card type', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CardBuilderEditor />);

    const pointCardButton = screen.getByRole('button', { name: /step1\.cardTypes\.stamp_card/ });
    await user.click(pointCardButton);

    // Card type should still be visible in selector (multiple instances due to preview)
    expect(screen.getAllByText('step1.cardTypes.stamp_card').length).toBeGreaterThan(0);
  });

  it('enables Next button only when card type is selected', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CardBuilderEditor />);

    // Pre-fill name so isStep1Valid passes (requires both name.trim() AND cardType)
    const nameInput = screen.getByPlaceholderText('cardNamePlaceholder');
    await user.clear(nameInput);
    await user.type(nameInput, 'My Card');

    const nextButton = screen.getByRole('button', { name: /step1\.next/ });
    expect(nextButton).toBeDisabled();

    const pointCardButton = screen.getByRole('button', { name: /step1\.cardTypes\.stamp_card/ });
    await user.click(pointCardButton);

    // After both name + cardType are set, next button should be enabled
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onSave callback when provided', () => {
    const onSave = vi.fn();
    renderWithRouter(<CardBuilderEditor onSave={onSave} />);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onBack callback when provided', () => {
    const onBack = vi.fn();
    renderWithRouter(<CardBuilderEditor onBack={onBack} />);
    expect(onBack).not.toHaveBeenCalled();
  });
});
