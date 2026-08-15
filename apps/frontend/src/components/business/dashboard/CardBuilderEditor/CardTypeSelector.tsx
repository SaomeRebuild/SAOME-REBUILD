/**
 * CardTypeSelector — 卡片類型選擇器（Step 1）
 * 3x3 格子，每格為一顆按鈕，icon 與文字上下排列
 */

import { useTranslation } from 'react-i18next';
import { Award, Wallet, Gift, CreditCard, Percent, Ticket, Layers, Package } from 'lucide-react';
import type { CardTypeOption, CardTypeSelectorProps } from './CardTypeSelector.types';
import type { CardType } from './CardBuilderEditor.types';

/** 8 種卡片類型定義 */
export const CARD_TYPE_OPTIONS: CardTypeOption[] = [
  { id: 'stamp_card', Icon: Award },
  { id: 'cashback_card', Icon: Wallet },
  { id: 'reward_card', Icon: Gift },
  { id: 'membership_card', Icon: CreditCard },
  { id: 'discount_card', Icon: Percent },
  { id: 'coupon_card', Icon: Ticket },
  { id: 'multipass', Icon: Layers },
  { id: 'gift_card', Icon: Package },
];

export function CardTypeSelector({ value, onChange }: CardTypeSelectorProps) {
  const { t } = useTranslation('cardEditor');

  function handleSelect(id: CardType) {
    onChange?.(id);
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {CARD_TYPE_OPTIONS.map((option) => {
        const isSelected = value === option.id;
        const { Icon } = option;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option.id)}
            aria-pressed={isSelected}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-xl border p-6
              transition-all duration-150
              ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary'
                  : 'border-border bg-card hover:scale-[1.02] hover:border-primary'
              }
            `}
          >
            <Icon
              size={32}
              aria-hidden="true"
              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
            />
            <span
              className={`
                text-sm font-medium
                ${isSelected ? 'text-primary' : 'text-foreground'}
              `}
            >
              {t(`step1.cardTypes.${option.id}`)}
            </span>
          </button>
        );
      })}
      {/* 第 8 格留空 */}
      <div className="hidden" aria-hidden="true" />
    </div>
  );
}
