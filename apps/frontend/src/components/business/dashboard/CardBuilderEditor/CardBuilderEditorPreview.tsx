/**
 * CardBuilderEditorPreview — 右欄位：即時預覽區
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { PreviewWrapper } from './PreviewWrapper';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';

export type CardSide = 'front' | 'back';

interface CardBuilderEditorPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 強制顯示預覽區（用於 Mobile Bottom Sheet，覆蓋 hidden lg:flex） */
  forceVisible?: boolean;
  /** 目前顯示的卡片面 */
  cardSide?: CardSide;
  /** 卡片面切換時 callback */
  onCardSideChange?: (side: CardSide) => void;
}

export function CardBuilderEditorPreview({
  forceVisible = false,
  cardSide = 'front',
  onCardSideChange,
  className,
  ...rest
}: CardBuilderEditorPreviewProps) {
  const { t } = useTranslation('cardEditor');

  // 從 store 取得卡片資料。
  // 2026-09-13 semantic swap:
  //   - `logoText` (NEW) — pass header text shown next to issuer logo.
  //     Passed to PreviewWrapper as the `name` prop (preview internal
  //     naming kept `name` for the "card identity on header" slot; the
  //     semantic content is Logo Text after the swap).
  //   - `cardName` is NOT forwarded to the preview — Card Name is the
  //     record name (library label), not shown on the pass itself.
  const {
    logoText,
    cardType,
    issuerLogo,
    holderName,
    backgroundColor,
    textColor,
    barcodeType,
    backgroundImage,
    backgroundImageVersion,
    cardId,
    // Step 3 — 顯示欄位（對應 templateSettings.leftField / rightField）
    leftField,
    rightField,
    // Step 3 — 集點印章（對應 templateSettings.stampGridRows / stampIconId）
    stampGridRows,
    stampIconId,
    // Step 6 — 集點卡邏輯（對應 templateSettings.rewardName）
    // 2026-09-10 stamp card member-level → reward refactor: this value
    // surfaces as the preview's `memberLevel` slot value when cardType is
    // `stamp_card`.
    rewardName,
    // Step 6 — 獎勵卡邏輯（對應 templateSettings.rewardTiers[0].name）
    // 2026-09-10 reward card member-level → reward refactor extension:
    // this value surfaces as the preview's `memberLevel` slot value when
    // cardType is `reward_card`. We read the FIRST tier's name only
    // (the user said "只取第一個ROW的資料"); empty / undefined when
    // no tiers have been added yet.
    rewardTiers,
    // Step 6 — Membership 卡邏輯 (2026-09-13, membership_card only):
    // `membershipTiers[0].rewards` → membershipTiersRewards
    // (rendered as Section 4 on the back side for membership cards).
    // 2026-09-13 fix (current task): `name` → firstMembershipTierName override
    // was REMOVED — membership cards now keep the default
    // fieldPreview.memberLevel label/value pair (會員等級 / 金級)
    // instead of being overridden to stampLabel + tier name.
    // `cardType === 'membership_card'` drives `isMembership` which gates the
    // strip's label/value pair layout + the back-side 會員獎勵 section.
    // 2026-09-13 fix (current task): isPaid is NO LONGER part of the
    // isMembership gate. The strip's 會員姓名/姓名 layout should display
    // as soon as the user picks `membership_card` — the isPaid flag is
    // Step 6 logic (whether the membership has paid tiers) and does NOT
    // affect what the strip shows. isPaid's autosave is handled in
    // CardBuilderEditor.tsx.
    membershipTiers,
    // Step 4 — 卡片資訊（對應 templateSettings.description / backFields / links）
    description,
    backFields,
    links,
  } = useCardBuilderStore();

  // 組裝背景圖 URL（cache-busting via backgroundImageVersion）
  const backgroundImageUrl = backgroundImage && cardId
    ? `${api.baseUrl}${api.paths.cardImage(cardId, 'background')}?token=${encodeURIComponent(getAccessToken() ?? '')}&v=${backgroundImageVersion}`
    : undefined;

  // 從 rewardTiers 取第一個 row 的 name 作為 reward_card 的 "獎勵" preview value.
  // 2026-09-10 reward card member-level → reward refactor: reward_card
  // memberLevel 選項的預覽值從第一個 tier 的 name 而非 top-level 字串讀取。
  // (Empty rewardTiers → undefined → PassCardPreviewBody fallback to ''.)
  const firstRewardTierName = rewardTiers.length > 0 ? rewardTiers[0]?.name : undefined;

  // 2026-09-13 membership card: membershipTiersRewards → PassCardPreviewBack
  // Section 4 (取代原本的 Section 1.5 — 背面欄位現在就是會員獎勵的位置)。
  // The first-tier-name override was REMOVED on 2026-09-13
  // — membership cards now keep the default
  // fieldPreview.memberLevel label/value pair ("會員等級" / "金級") instead
  // of being overridden to "獎勵" + tier name.
  const membershipTiersRewards =
    membershipTiers.length > 0 ? membershipTiers[0]?.rewards : undefined;

  // 2026-09-13 membership card: isMembership flag drives strip + back-side
  // membership layout. Only true when cardType === 'membership_card' (the
  // strip + back-side treatment is gated by card type alone, NOT by isPaid).
  // 2026-09-13 fix (current task): isPaid removed from the gate. isPaid is
  // Step 6 logic (paid tier editor visibility) and should NOT affect the
  // preview's strip + back-side membership layout. Free membership cards
  // and paid membership cards both show the same preview chrome.
  const isMembership = cardType === 'membership_card';

  return (
    <aside className={`
      w-full flex-col items-center justify-center gap-4 bg-background p-6
      ${forceVisible ? 'flex' : 'hidden lg:flex'}
      ${className || ''}
    `} {...rest}>
      {/* 預覽標題 */}
      <div className="flex w-full items-center gap-2 text-muted-foreground">
        <Eye size={16} aria-hidden="true" />
        <span className="text-sm font-medium">{t('preview.title')}</span>
      </div>

      {/* 卡片預覽（手機框架 + 卡片本體） */}
      <div className="flex h-auto w-full max-w-sm items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-4">
        {cardType ? (
          // 2026-09-13 swap: `name={name}` → `name={logoText}`. The
          // PreviewWrapper's `name` prop now receives the Logo Text
          // (pass header text), not the Card Name. The Card Name
          // (record name) is not shown in the preview — it lives only
          // in the user-facing library list.
          <PreviewWrapper
            name={logoText}
            cardType={cardType}
            issuerLogo={issuerLogo}
            backgroundImage={backgroundImageUrl}
            holderName={holderName}
            backgroundColor={backgroundColor}
            textColor={textColor}
            barcodeType={barcodeType}
            leftField={leftField}
            rightField={rightField}
            stampGridRows={stampGridRows}
            stampIconId={stampIconId}
            rewardName={rewardName}
            firstRewardTierName={firstRewardTierName}
            membershipTiersRewards={membershipTiersRewards}
            isMembership={isMembership}
            description={description}
            backFields={backFields}
            links={links}
            side={cardSide}
            showPhoneFrame={true}
          />
        ) : (
          <p className="text-muted-foreground">{t('preview.empty')}</p>
        )}
      </div>

      {/* 卡片正反面切換按鈕 */}
      <div className="flex w-full max-w-sm items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('preview.cardSide')}
        </span>
        <div className="flex rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => onCardSideChange?.('front')}
            className={`
              flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium
              transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${cardSide === 'front'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground active:scale-95'
              }
            `}
          >
            {t('preview.front')}
          </button>
          <button
            type="button"
            onClick={() => onCardSideChange?.('back')}
            className={`
              flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium
              transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${cardSide === 'back'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground active:scale-95'
              }
            `}
          >
            {t('preview.back')}
          </button>
        </div>
      </div>
    </aside>
  );
}
