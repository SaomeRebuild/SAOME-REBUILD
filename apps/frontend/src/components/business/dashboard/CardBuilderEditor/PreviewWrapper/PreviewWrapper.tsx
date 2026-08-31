/**
 * PreviewWrapper — 包裝層（PhoneFrame + PassCardPreview + PushNotificationMockup overlay）
 *
 * Phase 9 of IconUploader plan (2026-08-31):
 * - Added PushNotificationMockup overlay inside PhoneFrame (sibling to the card
 *   preview, not on the card itself).
 * - iconImage comes from store via CardBuilderEditorPreview → PreviewWrapper.
 * - PhoneFrame (L1 SVG shell) is intentionally NOT modified — see Rule 022.
 *
 * The overlay is rendered only when iconImage is present (push notifications
 * don't appear before the icon is uploaded).
 */

import { PhoneFrame } from '@/components/ui/phone';
import { PassCardPreview } from '../CardPreview';
import { PushNotificationMockup } from './PushNotificationMockup/PushNotificationMockup';
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
  iconImage,
  iconImageVersion,
  issuerName,
}: PreviewWrapperProps) {
  // PhoneFrame (L1) wraps the card + the optional push-notification mockup.
  // The mockup is a sibling of the card, presented inside the phone's status
  // bar area — visually similar to a real OS notification banner.
  if (showPhoneFrame) {
    return (
      <PhoneFrame className="w-full shadow-xl">
        <div className="relative h-full w-full">
          {/* push notification mockup (only when iconImage is set) */}
          {iconImage && (
            <PushNotificationMockup
              iconImage={iconImage}
              iconImageVersion={iconImageVersion}
              issuerName={issuerName ?? name}
            />
          )}
          {/* card preview sits below the notification overlay */}
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
