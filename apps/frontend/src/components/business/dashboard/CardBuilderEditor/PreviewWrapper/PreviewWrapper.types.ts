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
import type { CardFieldKey } from '@saome/shared/constants/card-fields';
import type { StampGridRows } from '@/components/business/stampCard/StampGridPreview';

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
  /**
   * 左欄位選取的 field key（null = 顯示 placeholder）。
   * 對應 templateSettings.leftField（DB 層）；傳遞給 PassCardPreview。
   */
  leftField?: CardFieldKey | null;
  /**
   * 右欄位選取的 field key（null = 顯示 placeholder）。
   * 對應 templateSettings.rightField（DB 層）；傳遞給 PassCardPreview。
   */
  rightField?: CardFieldKey | null;
  /**
   * 集點印章：行數（1..4）。對應 templateSettings.stampGridRows。
   * 與 cardType + stampIconId 共同決定 strip 是否 render StampGridPreview。
   * Stamp grid feature 2026-09-04。
   */
  stampGridRows?: StampGridRows;
  /**
   * 集點印章：icon manifest id（例如 'bell'）。對應 templateSettings.stampIconId。
   * 空字串或 undefined 時，strip 維持既有 CreditCard icon + name 渲染。
   * Stamp grid feature 2026-09-04。
   */
  stampIconId?: string;
  /**
   * 卡片描述（背面 Section 1）。對應 templateSettings.description。
   * Step 4 card-info 2026-09-04。
   */
  description?: string;
  /**
   * 背面欄位（背面 Section 4）。對應 templateSettings.backFields。
   * Step 4 card-info 2026-09-04。
   */
  backFields?: ReadonlyArray<{ label: string; value: string }>;
  /**
   * 專屬連結（背面 Section 5）。對應 templateSettings.links。
   * Step 4 card-info 2026-09-04。
   */
  links?: ReadonlyArray<{ label: string; value: string }>;
}
