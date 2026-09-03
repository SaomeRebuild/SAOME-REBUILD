/**
 * CardBuilderEditor — Zustand Store
 */

import { create } from 'zustand';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/card';
import { normalizeHex } from '@saome/shared/logic/color';

/**
 * Wrap raw 6-char hex (PassCreator format) into '#FFFFFF' for store internal use.
 * Defensive: handles legacy / malformed values by falling back.
 *
 * @param raw - Value loaded from DB (e.g. 'FFFFFF' from PassCreator, or null/undefined)
 * @param fallback - Store fallback value (current state) if normalization fails
 */
function normalizeLoadedColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const normalized = normalizeHex(raw);
  return normalized ? `#${normalized}` : fallback;
}

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
  /** issuerLogo 的版本號（用於 cache busting） */
  issuerLogoVersion: number;
  /** 推播通知 icon (R2 key per § 5.7 contract) */
  iconImage: string;
  /** iconImage 的版本號（用於 cache busting） */
  iconImageVersion: number;
  /** 卡片背景圖 (R2 key per § 5.7 contract) */
  backgroundImage: string;
  /** backgroundImage 的版本號（用於 cache busting） */
  backgroundImageVersion: number;
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
  setIconImage: (iconImage: string) => void;
  setBackgroundImage: (backgroundImage: string) => void;
  setBackgroundColor: (backgroundColor: string) => void;
  setTextColor: (textColor: string) => void;
  setHolderName: (holderName: string) => void;
  setBarcodeType: (barcodeType: BarcodeType) => void;
  setStoreName: (storeName: string) => void;
  setPassValidDays: (passValidDays: number | null) => void;
  setExpiryDate: (expiryDate: string) => void;
  setCurrency: (currency: 'TWD' | 'ZAR') => void;
  setIsPaid: (isPaid: boolean) => void;
  /**
   * 從既有 template 的 settings 載入 store.
   *
   * Defensive: Bug #8.5 — settings may be:
   *   - Partial<TemplateSettings> (normal)
   *   - JSON string (legacy corruption)
   *   - Array of partial merges (Bug #8 partial fix)
   *   - Array of jsonb strings (Bug #8.5 worst case)
   *
   * Accepts `unknown` because the helper handles all cases at runtime.
   */
  loadSettings: (settings: unknown) => void;
  reset: () => void;
}

/**
 * Defensive parser for `templates.settings` JSONB.
 *
 * Bug #8.5 (2026-08-31): The settings column may have been corrupted into:
 *   - a proper object (normal case)
 *   - a JSON string (legacy corruption where JSON.stringify(obj) was stored)
 *   - an array of partial merges (Bug #8 partial fix — array grew on each PUT)
 *   - an array containing jsonb **strings** (Bug #8.5 worst case)
 *
 * This helper handles all cases and returns a single merged object:
 *   - Object → passthrough
 *   - String → JSON.parse with try/catch (returns `{}` on failure)
 *   - Array → reduce-merge (later elements override earlier)
 *   - null/undefined → `{}`
 *
 * Exported so MediaAssetUploader and any other consumer can share the same
 * defensive logic (avoids drift between layers).
 */
export function unwrapCardSettings(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, unknown>>(
      (acc, elem) => ({ ...acc, ...unwrapCardSettings(elem) }),
      {},
    );
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
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
  issuerLogoVersion: 0,
  iconImage: '',
  iconImageVersion: 0,
  backgroundImage: '',
  backgroundImageVersion: 0,
  backgroundColor: '#ffffff',
  textColor: '#000000',
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
  setIssuerLogo: (issuerLogo) => set({ issuerLogo, issuerLogoVersion: Date.now() }),
  setIconImage: (iconImage) => set({ iconImage, iconImageVersion: Date.now() }),
  setBackgroundImage: (backgroundImage) => set({ backgroundImage, backgroundImageVersion: Date.now() }),
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
    // Bug #8.5 defensive: settings may be object / JSON string / array-of-partials
    // (legacy corruption). unwrapCardSettings handles all cases.
    const resolved = unwrapCardSettings(settings);

    console.log('[CardBuilderEditor] loadSettings resolved:', JSON.stringify(resolved));
    set((state) => {
      // Bug-φ fix (Phase 3 of icon-preview plan 2026-08-31): when a user
      // resumes a draft, the version for issuerLogo/iconImage was reset
      // to 0 by `reset()` in CardBuilderEditor's mount effect. If the
      // browser had previously cached a 404 / partial / stale response
      // for the same R2 key, the cached version would be served on reload
      // — leaving the icon image broken forever (until the user re-uploads).
      //
      // Bumping to Date.now() on loadSettings guarantees the URL has a
      // fresh cache-busting query param the moment we know a key exists,
      // forcing the browser to refetch from R2 (which now has the real
      // object, verified by Phase 2 wrangler evidence).
      const loadLogo = resolved?.issuerLogo as string | undefined;
      const loadIcon = resolved?.iconImage as string | undefined;
      const loadBg = resolved?.backgroundImage as string | undefined;
      const issuerLogo = loadLogo ?? state.issuerLogo;
      const iconImage = loadIcon ?? state.iconImage;
      const backgroundImage = loadBg ?? state.backgroundImage;
      return {
        name: (resolved?.name ?? state.name) as string,
        cardType: (resolved?.cardType ?? state.cardType) as CardType | null,
        issuerName: (resolved?.issuerName ?? state.issuerName) as string,
        issuerLogo,
        iconImage,
        // Bump version only if the key actually changed (or we just loaded one).
        issuerLogoVersion: loadLogo && loadLogo !== state.issuerLogo
          ? Date.now()
          : state.issuerLogoVersion,
        iconImageVersion: loadIcon && loadIcon !== state.iconImage
          ? Date.now()
          : state.iconImageVersion,
        backgroundImage,
        backgroundImageVersion: loadBg && loadBg !== state.backgroundImage
          ? Date.now()
          : state.backgroundImageVersion,
        backgroundColor: normalizeLoadedColor(resolved?.backgroundColor, state.backgroundColor),
        textColor: normalizeLoadedColor(resolved?.textColor, state.textColor),
        holderName: (resolved?.holderName ?? state.holderName) as string,
        barcodeType: (resolved?.barcodeType ?? state.barcodeType) as BarcodeType,
        storeName: (resolved?.storeName ?? state.storeName) as string,
        passValidDays: resolved?.passValidDays !== undefined ? resolved.passValidDays as number | null : state.passValidDays,
        expiryDate: (resolved?.expiryDate ?? state.expiryDate) as string,
        currency: (resolved?.currency ?? state.currency) as 'TWD' | 'ZAR',
        isPaid: (resolved?.isPaid ?? state.isPaid) as boolean,
      };
    });
  },

  reset: () => set({ ...initialState, isPaid: initialState.isPaid, issuerLogoVersion: 0, iconImageVersion: 0, backgroundImageVersion: 0 }),
}));
