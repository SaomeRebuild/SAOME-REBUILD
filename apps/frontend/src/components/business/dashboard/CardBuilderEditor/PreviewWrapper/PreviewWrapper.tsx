/**
 * PreviewWrapper — 包裝層（PhoneFrame + PassCardPreview）
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
  const cardContent = (
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

  if (showPhoneFrame) {
    return (
      <PhoneFrame className="w-full shadow-xl">
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
      </PhoneFrame>
    );
  }

  return cardContent;
}
