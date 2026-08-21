/**
 * CardBuilderEditor — 主元件 Props
 */

export type EditorStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type CardType =
  | 'stamp_card'
  | 'cashback_card'
  | 'reward_card'
  | 'membership_card'
  | 'discount_card'
  | 'coupon_card'
  | 'multipass'
  | 'gift_card';

export interface CardBuilderEditorProps {
  /** Template ID（edit 模式）。若為 null，則為新建模式 */
  templateId?: string | null;
  /** 初始卡片名稱（可選） */
  initialName?: string;
  /** 完成時 callback */
  onSave?: (data: CardBuilderEditorData) => void;
  /** 返回上一頁 */
  onBack?: () => void;
}

export interface CardBuilderEditorData {
  name: string;
  cardType?: CardType;
  step: EditorStep;
}
