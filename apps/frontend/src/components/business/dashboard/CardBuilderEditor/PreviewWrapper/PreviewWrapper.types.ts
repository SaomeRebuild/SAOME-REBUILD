/**
 * PreviewWrapper — 包裝層 Props
 *
 * Phase 9 of IconUploader plan (2026-08-31): added iconImage props to
 * support push notification overlay rendering. Icon is NOT part of the
 * card template itself (PassCardPreview stays untouched); the overlay
 * sits inside PhoneFrame (a sibling to the card) as a mockup of how the
 * push notification would look on the user's lock screen.
 */

import type { PassCardPreviewProps } from '../CardPreview/PassCardPreview.types';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';

export interface PreviewWrapperProps {
  /** 卡片名稱 */
  name: string;
  /** 卡片類型 */
  cardType?: PassCardPreviewProps['cardType'];
  /** 發卡機構標誌 */
  issuerLogo?: string;
  /** 卡片背景色 */
  backgroundColor?: string;
  /** 卡片文字色 */
  textColor?: string;
  /** 顯示的面 */
  side?: 'front' | 'back';
  /** 持有人名稱 */
  holderName?: string;
  /** Barcode 格式 */
  barcodeType?: BarcodeType;
  /** 是否顯示手機框架 */
  showPhoneFrame?: boolean;
  /** 推播通知 icon（R2 key,per shared/constants/card-images.ts § 5.7） */
  iconImage?: string;
  /** iconImage 的版本號,用於 cache busting */
  iconImageVersion?: number;
  /** 發卡機構名稱,用於推播通知標題 */
  issuerName?: string;
}
