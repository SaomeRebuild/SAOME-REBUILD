/**
 * CardBuilderEditor — Zustand Store
 */

import { create } from 'zustand';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/card';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import {
  BACK_FIELDS_MAX,
  LINKS_MAX,
} from '@saome/shared/constants/card-back-fields';
import { normalizeHex } from '@saome/shared/logic/color';

/**
 * A single { label, value } pair used by both Step 4 back fields and Step 4
 * links. Lives in shared scope is overkill for now (only consumed by this
 * store); define inline.
 */
export interface LabelValuePair {
  label: string;
  value: string;
}

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

  // ===== Step 3 — 顯示欄位 (left/right slots) =====
  /**
   * Step 3 plan 2026-09-04: two side-by-side native <select> dropdowns for
   * card face fields. Both default to `null` (placeholder "請選擇" shown).
   * Persisted to `template_settings.leftField / rightField` via the existing
   * JSONB merge semantics (see apps/backend/.../db/templates.ts::updateTemplate).
   */
  leftField: CardFieldKey | null;
  rightField: CardFieldKey | null;

  // ===== Membership Card Extension =====
  /** 會員卡是否收費（僅 membership_card 使用） */
  isPaid: boolean;

  // ===== Step 3 — Stamp Grid (集點印章) =====
  /**
   * Number of rows in the stamp grid (1..4). Persisted to
   * `template_settings.stampGridRows` via the JSONB merge semantics.
   * Default `1` = smallest grid (1×5 cells).
   *
   * Only used on `stamp_card` and `multipass` card types; the Step3StampGrid
   * editor section is hidden for other types (see CardBuilderEditorWorkspace).
   */
  stampGridRows: 1 | 2 | 3 | 4;
  /**
   * Stamp icon id (e.g. `'bell'`, `'fire'`) referencing the manifest at
   * `apps/frontend/src/assets/icons/stamps/manifest.ts`. Persisted to
   * `template_settings.stampIconId`. Empty string means "no icon selected"
   * — the preview falls back to a placeholder cell, not the existing
   * CreditCard icon + name.
   */
  stampIconId: string;

  // ===== Step 4 — 卡片資訊 (2026-09-04) =====
  /**
   * Card description (PassCardPreviewBack Section 1). Max 200 chars per
   * `shared/constants/card-back-fields.DESCRIPTION_MAX_LENGTH`. Required by
   * UI but the store allows empty so drafts can be edited mid-flight; the
   * workspace `isStep4Valid()` blocks "Next" when blank.
   */
  description: string;
  /**
   * Back fields (PassCardPreviewBack Section 4). Flat array of {label, value}
   * pairs. Always ≥ 1 row (`removeBackField` refills an empty row to enforce
   * the BACK_FIELDS_MIN=1 constraint). Capped at BACK_FIELDS_MAX=10 rows;
   * `addBackField` is a no-op at the cap.
   */
  backFields: LabelValuePair[];
  /**
   * Dedicated links (PassCardPreviewBack Section 5). Flat array of
   * {label, value} pairs where `value` is a URL. **Optional** — empty array
   * is the initial state. Capped at LINKS_MAX=4; `addLink` is a no-op at
   * the cap. Unlike backFields, `removeLink` does NOT auto-refill — the
   * user can delete all rows because links are optional.
   */
  links: LabelValuePair[];

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
  /**
   * Set the left-slot display field. Pass `null` to clear (shows placeholder).
   * `rightField` is NOT auto-cleared — dedup is enforced in the UI layer by
   * disabling the matching option on the other select.
   */
  setLeftField: (field: CardFieldKey | null) => void;
  /** Set the right-slot display field. See `setLeftField` for behavior. */
  setRightField: (field: CardFieldKey | null) => void;
  setIsPaid: (isPaid: boolean) => void;
  /**
   * Set the number of stamp grid rows (1..4). Out-of-range values are
   * rejected by the shared zod schema on save, but the setter accepts any
   * number so the editor UI can use the underlying <select> without
   * round-tripping through zod on every keystroke.
   */
  setStampGridRows: (rows: 1 | 2 | 3 | 4) => void;
  /** Set the stamp icon id (manifest id). Empty string = no icon. */
  setStampIconId: (iconId: string) => void;
  // ===== Step 4 setters =====
  /** Set the card description (max DESCRIPTION_MAX_LENGTH=200 enforced at zod save). */
  setDescription: (description: string) => void;
  /** Update one back-field row's label. */
  setBackFieldsLabel: (idx: number, label: string) => void;
  /** Update one back-field row's value. */
  setBackFieldsValue: (idx: number, value: string) => void;
  /**
   * Append one empty back-field row. No-op when `backFields.length` is
   * already at BACK_FIELDS_MAX — the UI button is also disabled at the cap
   * for double-belt-and-suspenders behavior.
   */
  addBackField: () => void;
  /**
   * Remove the row at `idx`. If the array would drop below BACK_FIELDS_MIN=1,
   * refills an empty row in place — keeps the UI always showing at least one
   * editable row.
   */
  removeBackField: (idx: number) => void;
  /** Update one link row's label. */
  setLinksLabel: (idx: number, label: string) => void;
  /** Update one link row's value. */
  setLinksValue: (idx: number, value: string) => void;
  /**
   * Append one empty link row. No-op when `links.length` is already at
   * LINKS_MAX=4 — the UI button is also disabled at the cap.
   */
  addLink: () => void;
  /**
   * Remove the link row at `idx`. Does NOT refill — links are optional,
   * the user is allowed to delete all rows.
   */
  removeLink: (idx: number) => void;
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

/**
 * Defensive parser for arrays of `{ label, value }` pairs (Step 4 back
 * fields & links). Returns the cleaned array on success, `fallback` when
 * the input is missing or malformed.
 *
 * Truncates to `maxLen` so a corrupted DB row with > 10 back fields
 * cannot blow up the UI editor. Each entry is coerced to `{ label: string,
 * value: string }`; any non-object entry is replaced with an empty pair.
 */
function sanitizeLabelValueArray(
  raw: unknown,
  current: LabelValuePair[],
  maxLen: number,
  fallback: LabelValuePair[],
): LabelValuePair[] {
  if (!Array.isArray(raw)) return fallback;
  const trimmed: LabelValuePair[] = [];
  for (const entry of raw.slice(0, maxLen)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      trimmed.push({
        label: typeof obj.label === 'string' ? obj.label : '',
        value: typeof obj.value === 'string' ? obj.value : '',
      });
    } else {
      trimmed.push({ label: '', value: '' });
    }
  }
  // Honor `current` only when the cleaned array is empty AND `current`
  // already had rows — i.e. don't wipe user-typed-but-unsaved data on a
  // re-load that happens to omit the field. For our two callers this is
  // moot (current always starts with at least the initial state row), but
  // it documents the intent.
  return trimmed.length > 0 ? trimmed : (current.length > 0 ? current : fallback);
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

  // ===== Step 3 — 顯示欄位 =====
  leftField: null,
  rightField: null,

  // ===== Membership Card Extension =====
  isPaid: false,

  // ===== Step 3 — Stamp Grid =====
  stampGridRows: 1 as 1 | 2 | 3 | 4,
  stampIconId: '',

  // ===== Step 4 — 卡片資訊 =====
  description: '',
  // Back fields: always ≥ 1 row (BACK_FIELDS_MIN=1 enforced by UI). Initial
  // state seeds one empty row so the first-render UI already shows an
  // editable input.
  backFields: [{ label: '', value: '' }],
  // Links: optional — empty initial array. UI shows "新增連結" button at first render.
  links: [],
};

/**
 * Type-annotated initial state. The bare object literal widens `stampGridRows: 1`
 * to `number`; this explicit const preserves the union `1 | 2 | 3 | 4`.
 */
const typedInitialState: Pick<
  CardBuilderState,
  keyof typeof initialState
> = initialState;

export const useCardBuilderStore = create<CardBuilderState>((set) => ({
  ...typedInitialState,

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
  setLeftField: (leftField) => set({ leftField }),
  setRightField: (rightField) => set({ rightField }),
  setIsPaid: (isPaid) => set({ isPaid }),
  setStampGridRows: (stampGridRows) => set({ stampGridRows }),
  setStampIconId: (stampIconId) => set({ stampIconId }),

  // ===== Step 4 setters =====
  setDescription: (description) => set({ description }),
  setBackFieldsLabel: (idx, label) =>
    set((state) => ({
      backFields: state.backFields.map((row, i) =>
        i === idx ? { ...row, label } : row,
      ),
    })),
  setBackFieldsValue: (idx, value) =>
    set((state) => ({
      backFields: state.backFields.map((row, i) =>
        i === idx ? { ...row, value } : row,
      ),
    })),
  addBackField: () =>
    set((state) => {
      if (state.backFields.length >= BACK_FIELDS_MAX) return {};
      return {
        backFields: [...state.backFields, { label: '', value: '' }],
      };
    }),
  removeBackField: (idx) =>
    set((state) => {
      const next = state.backFields.filter((_, i) => i !== idx);
      // BACK_FIELDS_MIN=1 — refill an empty row if the user just emptied
      // the array, so the editor stays usable (Apple EULA requires contact
      // info, so the user can never truly have 0 rows).
      if (next.length === 0) {
        return { backFields: [{ label: '', value: '' }] };
      }
      return { backFields: next };
    }),
  setLinksLabel: (idx, label) =>
    set((state) => ({
      links: state.links.map((row, i) =>
        i === idx ? { ...row, label } : row,
      ),
    })),
  setLinksValue: (idx, value) =>
    set((state) => ({
      links: state.links.map((row, i) =>
        i === idx ? { ...row, value } : row,
      ),
    })),
  addLink: () =>
    set((state) => {
      if (state.links.length >= LINKS_MAX) return {};
      return { links: [...state.links, { label: '', value: '' }] };
    }),
  removeLink: (idx) =>
    set((state) => ({
      // No auto-refill — links are optional, user can delete all rows.
      links: state.links.filter((_, i) => i !== idx),
    })),

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
        leftField: (resolved?.leftField ?? state.leftField) as CardFieldKey | null,
        rightField: (resolved?.rightField ?? state.rightField) as CardFieldKey | null,
        isPaid: (resolved?.isPaid ?? state.isPaid) as boolean,
        stampGridRows: (resolved?.stampGridRows ?? state.stampGridRows) as 1 | 2 | 3 | 4,
        stampIconId: (resolved?.stampIconId ?? state.stampIconId) as string,
        // ===== Step 4 (2026-09-04) =====
        // Description: string or undefined. Use ?? '' so loading an absent
        // description leaves a stale string behind only when one was already
        // typed — matches the semantics of other fields.
        description: (resolved?.description ?? state.description) as string,
        // backFields: array of {label, value}. Sanitize to plain pairs; if
        // the DB row had a malformed shape (e.g. legacy corruption) we fall
        // back to one empty row to keep the UI usable.
        backFields: sanitizeLabelValueArray(
          resolved?.backFields,
          state.backFields,
          BACK_FIELDS_MAX,
          /* fallbackWhenInvalid */ [{ label: '', value: '' }],
        ),
        links: sanitizeLabelValueArray(
          resolved?.links,
          state.links,
          LINKS_MAX,
          /* fallbackWhenInvalid */ [],
        ),
      };
    });
  },

  reset: () => set({ ...typedInitialState, isPaid: typedInitialState.isPaid, issuerLogoVersion: 0, iconImageVersion: 0, backgroundImageVersion: 0 }),
}));
