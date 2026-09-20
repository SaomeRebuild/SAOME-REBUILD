/**
 * Step2CardSettings — 卡片設定操作區（Step 2 主體）
 *
 * 包含 Barcode 選擇、卡片名稱（Card Name）、發卡機構、有效天數、到期日、貨幣（Base 欄位，所有卡種共用）。
 * membership_card 額外顯示收費設定。
 *
 * 2026-09-13 semantic swap: StoreNameField 改名 CardNameField.
 *   - 舊：storeName 寫入 settings.storeName（JSONB）。
 *   - 新：cardName 寫入 templates.name（SQL column, top-level payload）。
 */

import { BarcodeSelector } from './BarcodeSelector';
import { CardNameField } from './CardNameField';
import { IssuerNameField } from './IssuerNameField';
import { PassValidDaysField } from './PassValidDaysField';
import { ExpiryDateField } from './ExpiryDateField';
import { CurrencyField } from './CurrencyField';
import { LanguageField } from './LanguageField';
import { MembershipExtensionField } from './MembershipExtensionField';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface Step2CardSettingsProps {
  showValidation?: boolean;
}

export function Step2CardSettings({ showValidation }: Step2CardSettingsProps) {
  const cardType = useCardBuilderStore((s) => s.cardType);
  const isMembership = cardType === 'membership_card';
  // 2026-09-18: discount_card also has its own optional card-level expiry
  // (handled in Step 6 via DiscountExpiryFields). Hide Step 2's two
  // PassValidDaysField + ExpiryDateField rows to avoid double editors.
  const isDiscount = cardType === 'discount_card';
  // 2026-09-20: multipass has no time concept (no expiry, no valid days).
  // Hide both fields for multipass cards.
  const isMultipass = cardType === 'multipass';

  return (
    <div className="space-y-6">
      <BarcodeSelector />
      <CardNameField showValidation={showValidation} />
      <IssuerNameField showValidation={showValidation} />
      {/* Membership cards are long-lived identity passes — valid days /
          expiry date are meaningless. Hide both fields when cardType is
          membership_card (plan membership_card_conditional_ui_hide).
          Discount cards also handle expiry in Step 6
          (DiscountExpiryFields — mutual exclusion days vs date), so hide
          Step 2's fields here too (2026-09-18). */}
      {!isMembership && !isDiscount && !isMultipass && (
        <>
          <PassValidDaysField />
          <ExpiryDateField />
        </>
      )}
      <CurrencyField />
      <LanguageField />
      {cardType === 'membership_card' && <MembershipExtensionField />}
    </div>
  );
}
