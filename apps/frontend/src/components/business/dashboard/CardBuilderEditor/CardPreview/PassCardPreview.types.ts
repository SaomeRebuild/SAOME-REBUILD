import type { HTMLAttributes } from 'react';
import type { CardType } from '@/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.types';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';

/** 卡片預覽 Props */
export interface PassCardPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 卡片名稱 */
  name?: string;
  /** 卡片類型 */
  cardType?: CardType | null;
  /** 發卡機構名稱（可選） */
  issuerName?: string;
  /** 發卡機構標誌（可選，URL 或 SVG） */
  issuerLogo?: string;
  /** 卡片背景色 */
  backgroundColor?: string;
  /** 卡片文字色 */
  textColor?: string;
  /** 顯示的面（正面/背面） */
  side?: 'front' | 'back';
  /** 持有人名稱（背面顯示） */
  holderName?: string;
  /** 店名 */
  storeName?: string;
  /** Barcode 格式 */
  barcodeType?: BarcodeType;
  /** 緊湊模式（用於手機框架內，縮小字體和間距） */
  compact?: boolean;
}

/** Apple Pass 標準尺寸比例 */
export const PASS_ASPECT_RATIO = {
  width: 375,
  height: 503,
  ratio: '375 / 503',
} as const;
