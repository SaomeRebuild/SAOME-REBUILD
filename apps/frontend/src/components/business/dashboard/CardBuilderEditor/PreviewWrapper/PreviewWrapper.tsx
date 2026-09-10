/**
 * PreviewWrapper — 包裝層（PhoneFrame + PassCardPreview）
 *
 * The icon image is intentionally NOT shown inside the phone preview;
 * it is only shown in MediaAssetUploader/Preview (128×128) which reads
 * the same Zustand store independently.
 *
 * PhoneFrame (L1 SVG shell) is intentionally NOT modified — see Rule 022.
 *
 * MOBILE PREVIEW SIZE (2026-09-10):
 *   When the wrapper renders inside the mobile bottom sheet (CardBuilderEditorPreview
 *   is forced-visible via `forceVisible` prop in MobilePreviewPanel), the card is
 *   physically smaller (~310px phone frame → ~294px card content width vs 368px
 *   on desktop). To make the barcode / header / body / footer visually match
 *   real Apple Wallet on a phone (barcode takes ~25-30% of card width — see
 *   `runs/.../feedback/20260910-...` trace), the wrapper passes `compact={false}`
 *   on mobile viewports so PassCardPreview uses the larger (non-compact) sizing
 *   constants. Desktop (≥ 1024px / Tailwind `lg:` breakpoint, matching the
 *   `hidden lg:flex` on CardBuilderEditorPreview) keeps `compact={true}` so the
 *   existing right-column preview is unchanged.
 *
 *   The breakpoint is `1024px` (Tailwind `lg`), NOT the default `640px` (`sm`):
 *   MobilePreviewPanel uses `lg:hidden` and CardBuilderEditorPreview uses
 *   `hidden lg:flex`, so the actual mobile/desktop split is 1024px. Aligning
 *   `useIsMobile(1024)` with that split means the bottom sheet and the
 *   `compact={false}` decision agree on what "mobile" means.
 */

import { PhoneFrame } from '@/components/ui/phone';
import { PassCardPreview } from '../CardPreview';
import type { PreviewWrapperProps } from './PreviewWrapper.types';
import { useIsMobile } from '@/hooks/useIsMobile';

export function PreviewWrapper({
  name,
  cardType,
  issuerLogo,
  backgroundImage,
  backgroundColor,
  textColor,
  side = 'front',
  holderName,
  barcodeType,
  leftField,
  rightField,
  stampGridRows,
  stampIconId,
  rewardName,
  firstRewardTierName,
  description,
  backFields,
  links,
  showPhoneFrame = true,
}: PreviewWrapperProps) {
  // PhoneFrame (L1) wraps the card. The icon image preview lives in the
  // MediaAssetUploader panel (left column), not here.
  //
  // Mobile (viewport < 1024px) → compact=false → non-compact sizing
  //   (QR 80×80 / PDF417 128×200 → barcode takes 27% / 68% of card width,
  //   matching real Apple Wallet proportions on a phone).
  // Desktop (viewport ≥ 1024px) → compact=true → existing right-column sizing
  //   (QR 64×64 / PDF417 96×160, unchanged from before this change).
  const isMobile = useIsMobile(1024);

  if (showPhoneFrame) {
    return (
      <PhoneFrame className="w-full shadow-xl">
        <div className="relative h-full w-full">
          <PassCardPreview
            name={name}
            cardType={cardType}
            issuerLogo={issuerLogo}
            backgroundImage={backgroundImage}
            backgroundColor={backgroundColor}
            textColor={textColor}
            side={side}
            holderName={holderName}
            barcodeType={barcodeType}
            leftField={leftField}
            rightField={rightField}
            stampGridRows={stampGridRows}
            stampIconId={stampIconId}
            rewardName={rewardName}
            firstRewardTierName={firstRewardTierName}
            description={description}
            backFields={backFields}
            links={links}
            compact={!isMobile}
          />
        </div>
      </PhoneFrame>
    );
  }

  // No phone frame — render the bare card (for testing or non-preview contexts).
  // Bare-card branch keeps `compact={true}` regardless of viewport because it's
  // used by tests (jsdom has no real layout engine) and non-preview contexts
  // (e.g. embedding inside a form). The mobile-aware sizing is only meaningful
  // when the preview is rendered inside PhoneFrame + the bottom-sheet
  // container, where the card width is actually constrained by the viewport.
  return (
    <PassCardPreview
      name={name}
      cardType={cardType}
      issuerLogo={issuerLogo}
      backgroundImage={backgroundImage}
      backgroundColor={backgroundColor}
      textColor={textColor}
      side={side}
      holderName={holderName}
      barcodeType={barcodeType}
      leftField={leftField}
      rightField={rightField}
      stampGridRows={stampGridRows}
      stampIconId={stampIconId}
      rewardName={rewardName}
      firstRewardTierName={firstRewardTierName}
      description={description}
      backFields={backFields}
      links={links}
    />
  );
}
