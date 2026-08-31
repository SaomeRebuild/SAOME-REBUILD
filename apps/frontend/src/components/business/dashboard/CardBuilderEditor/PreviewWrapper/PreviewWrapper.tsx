/**
 * PreviewWrapper — 包裝層（PhoneFrame + PassCardPreview）
 *
 * The icon image is intentionally NOT shown inside the phone preview;
 * it is only shown in MediaAssetUploader/Preview (128×128) which reads
 * the same Zustand store independently.
 *
 * PhoneFrame (L1 SVG shell) is intentionally NOT modified — see Rule 022.
 */

import { PhoneFrame } from '@/components/ui/phone';
import { PassCardPreview } from '../CardPreview';
import type { PreviewWrapperProps } from './PreviewWrapper.types';

export function PreviewWrapper({
  name,
  cardType,
  issuerLogo,
  backgroundColor,
  textColor,
  side = 'front',
  holderName,
  barcodeType,
  showPhoneFrame = true,
}: PreviewWrapperProps) {
  // PhoneFrame (L1) wraps the card. The icon image preview lives in the
  // MediaAssetUploader panel (left column), not here.
  if (showPhoneFrame) {
    return (
      <PhoneFrame className="w-full shadow-xl">
        <div className="relative h-full w-full">
          <PassCardPreview
            name={name}
            cardType={cardType}
            issuerLogo={issuerLogo}
            backgroundColor={backgroundColor}
            textColor={textColor}
            side={side}
            holderName={holderName}
            barcodeType={barcodeType}
            compact={true}
          />
        </div>
      </PhoneFrame>
    );
  }

  // No phone frame — render the bare card (for testing or non-preview contexts).
  return (
    <PassCardPreview
      name={name}
      cardType={cardType}
      issuerLogo={issuerLogo}
      backgroundColor={backgroundColor}
      textColor={textColor}
      side={side}
      holderName={holderName}
      barcodeType={barcodeType}
    />
  );
}
