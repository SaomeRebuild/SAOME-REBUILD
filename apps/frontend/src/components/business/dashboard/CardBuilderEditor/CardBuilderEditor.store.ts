/**
 * CardBuilderEditor — Zustand Store
 */

import { create } from 'zustand';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import type { BarcodeType, TemplateSettings } from '@saome/shared/schemas/card';

interface CardBuilderState {
  /** Template ID（從後端建立，null = 新建模式） */
  cardId: string | null;
  /** 卡片名稱 */
  name: string;
  /** 卡片類型 */
  cardType: CardType | null;
  /** 目前步驟 */
  step: EditorStep;
  /** 已完成的步驟 */
  completedSteps: Set<EditorStep>;
  /** 卡片顯示的面 */
  cardSide: 'front' | 'back';
  /** 發卡機構名稱 */
  issuerName: string;
  /** 發卡機構標誌 */
  issuerLogo: string;
  /** 卡片背景色 */
  backgroundColor: string;
  /** 卡片文字色 */
  textColor: string;
  /** 持有人名稱 */
  holderName: string;

  // ===== Step 2 Base 欄位（所有卡種共用）=====
  /** Barcode 格式 */
  barcodeType: BarcodeType;
  /** 店名 */
  storeName: string;
  /** PASS 有效天數（非必填，null = 未填） */
  passValidDays: number | null;
  /** 到期日設定（非必填） */
  expiryDate: string;
  /** 貨幣選擇 */
  currency: 'TWD' | 'ZAR';

  // ===== Membership Card Extension =====
  /** 會員卡是否收費（僅 membership_card 使用） */
  isPaid: boolean;

  // Actions
  setCardId: (cardId: string | null) => void;
  setName: (name: string) => void;
  setCardType: (cardType: CardType | null) => void;
  setStep: (step: EditorStep) => void;
  setCompletedStep: (step: EditorStep) => void;
  setCardSide: (side: 'front' | 'back') => void;
  setIssuerName: (issuerName: string) => void;
  setIssuerLogo: (issuerLogo: string) => void;
  setBackgroundColor: (backgroundColor: string) => void;
  setTextColor: (textColor: string) => void;
  setHolderName: (holderName: string) => void;
  setBarcodeType: (barcodeType: BarcodeType) => void;
  setStoreName: (storeName: string) => void;
  setPassValidDays: (passValidDays: number | null) => void;
  setExpiryDate: (expiryDate: string) => void;
  setCurrency: (currency: 'TWD' | 'ZAR') => void;
  setIsPaid: (isPaid: boolean) => void;
  /** 從既有 template 的 settings 載入 store */
  loadSettings: (settings: Partial<TemplateSettings>) => void;
  reset: () => void;
}

const initialState = {
  cardId: null,
  name: '',
  cardType: null,
  step: 1 as EditorStep,
  completedSteps: new Set<EditorStep>(),
  cardSide: 'front' as const,
  issuerName: '',
  issuerLogo: '',
  backgroundColor: '#1a1a1a',
  textColor: '#ffffff',
  holderName: '',

  // ===== Step 2 Base =====
  barcodeType: 'qr_code' as BarcodeType,
  storeName: '',
  passValidDays: null,
  expiryDate: '',
  currency: 'TWD' as const,

  // ===== Membership Card Extension =====
  isPaid: false,
};

export const useCardBuilderStore = create<CardBuilderState>((set) => ({
  ...initialState,

  setCardId: (cardId) => set({ cardId }),
  setName: (name) => set({ name }),
  setCardType: (cardType) => set({ cardType }),
  setStep: (step) => set({ step }),
  setCompletedStep: (step) => set((state) => ({
    completedSteps: new Set([...state.completedSteps, step]),
  })),
  setCardSide: (cardSide) => set({ cardSide }),
  setIssuerName: (issuerName) => set({ issuerName }),
  setIssuerLogo: (issuerLogo) => set({ issuerLogo }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setTextColor: (textColor) => set({ textColor }),
  setHolderName: (holderName) => set({ holderName }),
  setBarcodeType: (barcodeType) => set({ barcodeType }),
  setStoreName: (storeName) => set({ storeName }),
  setPassValidDays: (passValidDays) => set({ passValidDays }),
  setExpiryDate: (expiryDate) => set({ expiryDate }),
  setCurrency: (currency) => set({ currency }),
  setIsPaid: (isPaid) => set({ isPaid }),

  loadSettings: (settings) => {
    // Guard: settings can be a single object or an array of partial merges.
    // Deep-merge all array elements to recover the most complete field set.
    // Defensive: settings can be a JSON string (malformed DB row) or object.
    const resolved: Record<string, unknown> = Array.isArray(settings)
      ? settings.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...s }), {})
      : typeof settings === 'string'
        ? JSON.parse(settings)
        : (settings ?? {});

    console.log('[CardBuilderEditor] loadSettings resolved:', JSON.stringify(resolved));
    set((state) => ({
      name: (resolved?.name ?? state.name) as string,
      cardType: (resolved?.cardType ?? state.cardType) as CardType | null,
      issuerName: (resolved?.issuerName ?? state.issuerName) as string,
      issuerLogo: (resolved?.issuerLogo ?? state.issuerLogo) as string,
      backgroundColor: (resolved?.backgroundColor ?? state.backgroundColor) as string,
      textColor: (resolved?.textColor ?? state.textColor) as string,
      holderName: (resolved?.holderName ?? state.holderName) as string,
      barcodeType: (resolved?.barcodeType ?? state.barcodeType) as BarcodeType,
      storeName: (resolved?.storeName ?? state.storeName) as string,
      passValidDays: resolved?.passValidDays !== undefined ? resolved.passValidDays as number | null : state.passValidDays,
      expiryDate: (resolved?.expiryDate ?? state.expiryDate) as string,
      currency: (resolved?.currency ?? state.currency) as 'TWD' | 'ZAR',
      isPaid: (resolved?.isPaid ?? state.isPaid) as boolean,
    }));
  },

  reset: () => set({ ...initialState, isPaid: initialState.isPaid }),
}));
