/**
 * PassCardPreview — 卡片正面預覽（Header 部分）
 * 固定白色背景（模擬實體 Pass），字色用 neutral 確保可讀
 *
 * Balance preview (2026-09-08):
 *   For cardType ∈ {stamp_card, reward_card, cashback_card}, the right-side
 *   card-type pill is replaced with a 2-line vertical block:
 *     - label: "餘額" / "Balance"
 *     - value: 200元 / R100 — selected by store.currency (TWD → 200元, ZAR → R100)
 *
 *   All other card types keep the original single-line rounded-full pill.
 *   The currency display is driven by the Zustand store (reactive — when
 *   the user switches currency in Step 2, the preview re-renders).
 */
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { CardType } from '../CardBuilderEditor.types';
import { BALANCE_PREVIEW_AMOUNTS } from '@saome/shared/constants/balancePreview';

interface PassCardPreviewHeaderProps {
  cardType?: string | null;
  issuerLogo?: string;
  name?: string;
  /** Optional text color override (hex with #). When provided, applied to card name + card type badge. */
  textColor?: string;
  compact?: boolean;
}

/**
 * Card types for which the right-side pill is replaced by a 2-line balance
 * preview block. Kept as a module-level constant so it can be imported by
 * tests / future callers without re-deriving the membership test.
 *
 * Distinct from `STAMP_CARD_TYPES` in `Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts`
 * — that set governs the Step 3 left/right field dropdown filter, while this
 * set governs the live preview header. The two overlap on `stamp_card` but
 * have different second members (multipass vs. reward_card/cashback_card).
 */
export const BALANCE_PREVIEW_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'stamp_card',
  'reward_card',
  'cashback_card',
]);

/**
 * Type guard: returns true iff the card type should render the balance
 * preview. Encodes both "cardType is non-null" and "cardType is in the
 * target set" so the consumer branch is exhaustive.
 */
export function shouldShowBalancePreview(
  cardType: string | null | undefined,
): cardType is CardType {
  return (
    cardType !== null &&
    cardType !== undefined &&
    BALANCE_PREVIEW_CARD_TYPES.has(cardType as CardType)
  );
}

export function PassCardPreviewHeader({ cardType, issuerLogo, name, textColor, compact }: PassCardPreviewHeaderProps) {
  const { t } = useTranslation('passCard');

  // Build proxy URL: avoids relying on Windows DNS resolving saome-assets.pages.dev
  // Note: getState() is intentional — cardId / issuerLogoVersion don't change during
  // a single preview render cycle. currency, by contrast, can change in Step 2 while
  // the preview is mounted, so it MUST use the reactive hook form.
  const templateId = useCardBuilderStore.getState().cardId;
  const issuerLogoVersion = useCardBuilderStore.getState().issuerLogoVersion;
  const currency = useCardBuilderStore((s) => s.currency);
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}&v=${issuerLogoVersion}`
    : undefined;

  const showBalance = shouldShowBalancePreview(cardType);

  return (
    <div className={compact ? 'flex items-center justify-between px-2 pt-2' : 'flex items-center justify-between px-4 pt-4'}>
      {/* Logo 區 */}
      <div className="flex flex-col gap-1">
        <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-2'}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={t('defaultIssuerName')}
              className={compact ? 'h-5 w-5' : 'h-8 w-8'}
              style={{ borderRadius: 'inherit', objectFit: 'contain' }}
            />
          ) : (
            <Building2 size={compact ? 16 : 24} className="text-neutral-400" aria-hidden="true" />
          )}
          {/* Card name — textColor 套用範圍 #1 (header 名稱) */}
          <span
            className={compact ? 'text-xs font-bold leading-tight' : 'text-sm font-bold'}
            style={textColor ? { color: textColor } : undefined}
          >
            {name || t('defaultIssuerName')}
          </span>
        </div>
      </div>

      {/* 右側：cardType ∈ {stamp_card, reward_card, cashback_card} → 兩行垂直「餘額」預覽;
          其他卡種 → 維持原 rounded-full pill (textColor 套用範圍 #2)。
          Typography 對齊 PassCardPreviewBody：label 10/8px、value 14/11px，字級差 4px。
          font-bold 強調數字（vs. pill 的 font-medium）。 */}
      {showBalance ? (
        <div
          className={compact
            ? 'flex flex-col items-start gap-0 leading-tight'
            : 'flex flex-col items-start gap-0.5 leading-tight'}
        >
          <span
            className={compact ? 'text-[8px] font-medium' : 'text-[10px] font-medium'}
            style={textColor ? { color: textColor } : undefined}
          >
            {t('balancePreview.label')}
          </span>
          <span
            className={compact ? 'text-[11px] font-bold' : 'text-sm font-bold'}
            style={textColor ? { color: textColor } : undefined}
          >
            {BALANCE_PREVIEW_AMOUNTS[currency]}
          </span>
        </div>
      ) : (
        // ─── Default pill (textColor 套用範圍 #2 — card type 標籤) ───
        // 背景透明（2026-09-03 修正）：避免灰色色塊切斷卡片色彩統一性
        <span
          className={compact
            ? 'rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none'
            : 'rounded-full px-2 py-0.5 text-xs font-medium'
          }
          style={textColor ? { color: textColor } : undefined}
        >
          {cardType ?? t('defaultCardType')}
        </span>
      )}
    </div>
  );
}
