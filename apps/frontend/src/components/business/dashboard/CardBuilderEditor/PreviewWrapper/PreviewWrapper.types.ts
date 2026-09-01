/**
 * PreviewWrapper — 包裝層 Props
 *
 * Wraps PassCardPreview inside PhoneFrame (optional). The wrapper currently
 * only forwards card props to the preview; the icon image is consumed
 * independently by MediaAssetUploader/Preview (128×128) which reads from
 * the same Zustand store.
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
  /** 卡片背景圖（可選，R2 URL）*/
  backgroundImage?: string;
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
}
