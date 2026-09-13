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
 *
 * Member expiry preview (2026-09-13):
 *   For cardType === 'membership_card', the right-side card-type pill is
 *   replaced with a 2-line vertical block:
 *     - label: "會員到期日" / "Member Expiry"
 *     - value: store.hasExpiry-driven:
 *         - hasExpiry=false → "∞" (infinity symbol)
 *         - hasExpiry=true and expiryDate set → formatted expiryDate
 *           (zh-TW: "2027.10.23" YYYY.MM.DD; en: "10.23.2027" MM.DD.YYYY)
 *         - hasExpiry=true and expiryDate empty → DEFAULT_EXPIRY_DATE
 *           formatted per locale (membership card intentionally hides
 *           step2's PassValidDaysField + ExpiryDateField, so the preview
 *           has no source to read from — fall back to a hardcoded default
 *           instead of the "—" placeholder)
 *   The expiry date format is locale-driven (i18n.language). The infinity
 *   symbol is universal (matches user-confirmed UX).
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
 * Card types for which the right-side pill is replaced by a 2-line member
 * expiry preview block. Scoped to membership_card ONLY (2026-09-13).
 */
export const MEMBER_EXPIRY_PREVIEW_CARD_TYPES: ReadonlySet<CardType> = new Set<CardType>([
  'membership_card',
]);

/**
 * Default expiry date used when hasExpiry=true but expiryDate is empty.
 * Hardcoded because the membership card hides step2's PassValidDaysField +
 * ExpiryDateField by design (see membership_card_conditional_ui_hide plan),
 * leaving the preview with no source to read from. The date "2027-10-23"
 * matches the existing happy-path test fixture.
 */
const DEFAULT_EXPIRY_DATE = '2027-10-23';

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

/**
 * Type guard: returns true iff the card type should render the member
 * expiry preview. Scoped to `membership_card` only.
 */
export function shouldShowMemberExpiryPreview(
  cardType: string | null | undefined,
): cardType is CardType {
  return (
    cardType !== null &&
    cardType !== undefined &&
    MEMBER_EXPIRY_PREVIEW_CARD_TYPES.has(cardType as CardType)
  );
}

/**
 * Format an ISO YYYY-MM-DD expiry date string for display, locale-aware.
 *
 *   zh-TW: YYYY.MM.DD  (e.g. "2027.10.23" per user-confirmed UX)
 *   en:    MM.DD.YYYY  (e.g. "10.23.2027" US-style per user-confirmed UX)
 *
 * Returns the original string (verbatim) if it doesn't match YYYY-MM-DD —
 * defensive against malformed input from the store (the DB layer enforces
 * the format, but the preview must not crash on weird input).
 */
export function formatExpiryDate(isoDate: string, locale: string): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  const isZhLocale = (locale ?? '').startsWith('zh');
  if (isZhLocale) return `${year}.${month}.${day}`;
  return `${month}.${day}.${year}`;
}

export function PassCardPreviewHeader({ cardType, issuerLogo, name, textColor, compact }: PassCardPreviewHeaderProps) {
  const { t, i18n } = useTranslation('passCard');

  // Build proxy URL: avoids relying on Windows DNS resolving saome-assets.pages.dev
  // Note: getState() is intentional — cardId / issuerLogoVersion don't change during
  // a single preview render cycle. currency, by contrast, can change in Step 2 while
  // the preview is mounted, so it MUST use the reactive hook form.
  const templateId = useCardBuilderStore.getState().cardId;
  const issuerLogoVersion = useCardBuilderStore.getState().issuerLogoVersion;
  const currency = useCardBuilderStore((s) => s.currency);
  // 2026-09-13 member expiry preview: read hasExpiry + expiryDate from store.
  // hasExpiry is reactive (toggled in Step 6). expiryDate is reactive (set in
  // Step 2 via ExpiryDateField).
  const hasExpiry = useCardBuilderStore((s) => s.hasExpiry);
  const expiryDate = useCardBuilderStore((s) => s.expiryDate);
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}&v=${issuerLogoVersion}`
    : undefined;

  const showBalance = shouldShowBalancePreview(cardType);
  const showMemberExpiry = shouldShowMemberExpiryPreview(cardType);

  // Member expiry value:
  //   - hasExpiry=false → "∞" (infinity, universal across locales)
  //   - hasExpiry=true + expiryDate set → formatted per locale (YYYY.MM.DD / MM.DD.YYYY)
  //   - hasExpiry=true + expiryDate empty → DEFAULT_EXPIRY_DATE formatted per locale
  //     (2026-09-13 fix: membership card hides step2's PassValidDaysField +
  //      ExpiryDateField by design, so the preview has no source to read from.
  //      Use a hardcoded default instead of the "—" placeholder.)
  const memberExpiryValue = (() => {
    if (!hasExpiry) return '∞';
    return formatExpiryDate(expiryDate || DEFAULT_EXPIRY_DATE, i18n.language ?? '');
  })();

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

      {/* 右側：membership_card → 會員到期日預覽（2-line vertical block）
              cardType ∈ {stamp_card, reward_card, cashback_card} → 兩行垂直「餘額」預覽
              其他卡種 → 維持原 rounded-full pill
          Typography 對齊 PassCardPreviewBody：label 10/8px、value 14/11px，字級差 4px。
          font-bold 強調數字（vs. pill 的 font-medium）。 */}
      {showMemberExpiry ? (
        <div
          className={compact
            ? 'flex flex-col items-start gap-0 leading-tight'
            : 'flex flex-col items-start gap-0.5 leading-tight'}
          data-testid="member-expiry-preview"
        >
          <span
            className={compact ? 'text-[8px] font-medium' : 'text-[10px] font-medium'}
            style={textColor ? { color: textColor } : undefined}
          >
            {t('memberExpiry.label')}
          </span>
          <span
            className={compact ? 'text-[11px] font-bold' : 'text-sm font-bold'}
            style={textColor ? { color: textColor } : undefined}
          >
            {memberExpiryValue}
          </span>
        </div>
      ) : showBalance ? (
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
