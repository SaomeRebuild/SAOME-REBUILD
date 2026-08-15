/**
 * CardTypeSelector — 卡片類型選擇器 Props
 */

import type { LucideIcon } from 'lucide-react';
import type { CardType } from './CardBuilderEditor.types';

export interface CardTypeOption {
  id: CardType;
  /** Lucide icon component */
  Icon: LucideIcon;
}

export interface CardTypeSelectorProps {
  /** 當前選中的卡片類型 */
  value?: CardType | null;
  /** 選中時 callback */
  onChange?: (type: CardType) => void;
}
