/**
 * PassCardPreview — Props
 *
 * The card template itself only renders logo / type label / holder name /
 * barcode — no icon or background image injected. The icon image preview
 * lives in MediaAssetUploader/Preview (128×128 panel in the editor
 * workspace).
 */

/** Apple Pass 標準尺寸比例 */
export const PASS_ASPECT_RATIO = {
  width: 375,
  height: 503,
  ratio: '375 / 503',
} as const;

import type { HTMLAttributes } from 'react';
import type { CardType } from '@/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';

/** 卡片預覽 Props */
export interface PassCardPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 卡片名稱 */
  name?: string;
  /** 卡片類型 */
  cardType?: CardType | null;
  /** 發卡機構標誌（可選，URL 或 SVG） */
  issuerLogo?: string;
  /** 卡片背景圖（可選，R2 URL）— 套用到整張卡片，而非僅 strip */
  backgroundImage?: string;
  /** 卡片背景色（可選）— 當無背景圖時作為卡片本體背景色（預設白色） */
  backgroundColor?: string;
  /** 卡片文字色 */
  textColor?: string;
  /** 顯示的面（正面/背面） */
  side?: 'front' | 'back';
  /** 持有人名稱（背面顯示） */
  holderName?: string;
  /** Barcode 格式 */
  barcodeType?: BarcodeType;
  /** 緊湊模式（用於手機框架內，縮小字體和間距） */
  compact?: boolean;
  /**
   * 左欄位選取的 field key（null = 顯示 placeholder）
   * 對應 templateSettings.leftField（DB 層）。當 null/undefined 時，body 顯示 placeholder。
   * 對應 PassCreator secondaryFields[0]：label = fieldPreview.{key}.label, value = fieldPreview.{key}.value。
   */
  leftField?: CardFieldKey | null;
  /**
   * 右欄位選取的 field key（null = 顯示 placeholder）
   * 對應 templateSettings.rightField（DB 層）。當 null/undefined 時，body 顯示 placeholder。
   * 對應 PassCreator secondaryFields[1]：label = fieldPreview.{key}.label, value = fieldPreview.{key}.value。
   */
  rightField?: CardFieldKey | null;
}
