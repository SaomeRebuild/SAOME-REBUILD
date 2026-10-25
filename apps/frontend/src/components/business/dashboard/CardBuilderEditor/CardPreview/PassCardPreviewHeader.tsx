/**
 * PassCardPreview — 卡片正面預覽（Header 部分）
 * 固定白色背景（模擬實體 Pass），字色用 neutral 確保可讀
 *
 * Header right slot (2026-10-24 refactor):
 *   The per-cardType branch tree that decides what the header's right
 *   side shows (member expiry / discount expiry / coupon expiry /
 *   balance / gift points) now lives in ONE place:
 *   `passCardPreviewSlot.ts::resolveHeaderRightSlot`, which dispatches
 *   on the shared cardType → kind spec
 *   (`@saome/shared/constants/headerSlots.ts`).
 *
 *   Before this refactor this file carried its OWN copy of that tree:
 *   five `ReadonlySet<CardType>` constants, five `shouldShowXxxPreview`
 *   type guards, its own now-removed expiry-date formatter, and its own
 *   "today + N days" date math — all duplicating what
 *   `passCardPreviewSlot.ts` already did for the template library
 *   preview. Four copies of one rule across the codebase.
 *
 *   The balance preview block was also MISSING its `data-testid`
 *   (the other four preview blocks had one). Rendering the shared
 *   slot output restores it.
 *
 *   Render behavior is unchanged: every preview block is the same
 *   2-line vertical layout (label above value, both left-aligned),
 *   with the same compact / non-compact typography.
 */
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { CardType } from '../CardBuilderEditor.types';
import { resolveHeaderRightSlot } from './passCardPreviewSlot';

interface PassCardPreviewHeaderProps {
  cardType?: string | null;
  issuerLogo?: string;
  name?: string;
  /** Optional text color override (hex with #). When provided, applied to card name + card type badge. */
  textColor?: string;
  compact?: boolean;
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
  // 2026-09-18 discount expiry preview: read discountCustomExpiryDays +
  // discountSpecificExpiryDate from store. Both are reactive (mutually
  // exclusive — setDiscountCustomExpiryDays clears the date, and vice versa,
  // per Step 6 DiscountExpiryFields). The expiry is mandatory per
  // `discount.expiryBothNullError` validation, so the "both null" case is
  // theoretical; we fall back to "—" defensively.
  const discountCustomExpiryDays = useCardBuilderStore((s) => s.discountCustomExpiryDays);
  const discountSpecificExpiryDate = useCardBuilderStore((s) => s.discountSpecificExpiryDate);
  // 2026-09-19 coupon expiry preview: read passValidDays + expiryDate from
  // the Step 2 card-level expiry fields. Unlike membership_card (which
  // hides these fields), coupon_card KEEPS them visible — both fields
  // may be independently set, and the preview falls back to "∞" only
  // when BOTH are empty. Falls through to the regular `default pill`
  // branch when cardType is not coupon_card (this read is always safe).
  const passValidDays = useCardBuilderStore((s) => s.passValidDays);
  const token = getAccessToken();
  const logoUrl = issuerLogo && templateId
    ? `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}${token ? `?token=${encodeURIComponent(token)}` : ''}&v=${issuerLogoVersion}`
    : undefined;

  // 2026-10-24 — the shared resolver decides which 2-line preview block
  // (or default pill) replaces the right side of the card header.
  // It reads the SAME spec the backend template push uses
  // (`@saome/shared/constants/headerSlots.ts`), so the editor preview
  // and the deployed pass can no longer disagree about the slot.
  const headerRightSlot = resolveHeaderRightSlot(t, {
    cardType: cardType as CardType | null | undefined,
    hasExpiry,
    expiryDate,
    discountCustomExpiryDays,
    discountSpecificExpiryDate,
    passValidDays,
    currency,
    // Defensive i18n lookup: existing PassCardPreview.test.tsx mocks do
    // NOT provide `i18n` in the useTranslation return value, so we must
    // tolerate a missing i18n object here (the date formatter falls
    // back to the en format when locale is empty).
    locale: i18n?.language ?? '',
  });

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

      {/* 右側：header right slot。
          2026-10-24 — 由 `resolveHeaderRightSlot` 決定顯示哪一種 2-line
          preview block（會員到期日 / 有效期限 / 餘額 / 點數）或 fallback pill。
          Typography 對齊 PassCardPreviewBody：label 10/8px、value 14/11px，字級差 4px。
          font-bold 強調數字（vs. pill 的 font-medium）。 */}
      {headerRightSlot.kind === 'preview' ? (
        <div
          className={compact
            ? 'flex flex-col items-start gap-0 leading-tight'
            : 'flex flex-col items-start gap-0.5 leading-tight'}
          data-testid={headerRightSlot.testId}
        >
          <span
            className={compact ? 'text-[8px] font-medium' : 'text-[10px] font-medium'}
            style={textColor ? { color: textColor } : undefined}
          >
            {headerRightSlot.label}
          </span>
          <span
            className={compact ? 'text-[11px] font-bold' : 'text-sm font-bold'}
            style={textColor ? { color: textColor } : undefined}
          >
            {headerRightSlot.value}
          </span>
        </div>
      ) : (
        // ─── Default pill (textColor 套用範圍 #2 — card type 標籤) ───
        // 背景透明（2026-09-03 修正）：避免灰色色塊切斷卡片色彩統一性
        <span
          className={compact
            ? 'rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none'
            : 'rounded-full px-2 py-0.5 text-xs font-medium'}
          style={textColor ? { color: textColor } : undefined}
        >
          {cardType ?? headerRightSlot.label}
        </span>
      )}
    </div>
  );
}
