/**
 * Step2CardSettings — 卡片設定操作區（Step 2 主體）
 *
 * 包含 Barcode 選擇、店名、發卡機構、有效天數、到期日、貨幣（Base 欄位，所有卡種共用）。
 * membership_card 額外顯示收費設定。
 */

import { BarcodeSelector } from './BarcodeSelector';
import { StoreNameField } from './StoreNameField';
import { IssuerNameField } from './IssuerNameField';
import { PassValidDaysField } from './PassValidDaysField';
import { ExpiryDateField } from './ExpiryDateField';
import { CurrencyField } from './CurrencyField';
import { MembershipExtensionField } from './MembershipExtensionField';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

interface Step2CardSettingsProps {
  showValidation?: boolean;
}

export function Step2CardSettings({ showValidation }: Step2CardSettingsProps) {
  const cardType = useCardBuilderStore((s) => s.cardType);

  return (
    <div className="space-y-6">
      <BarcodeSelector />
      <StoreNameField showValidation={showValidation} />
      <IssuerNameField showValidation={showValidation} />
      <PassValidDaysField />
      <ExpiryDateField />
      <CurrencyField />
      {cardType === 'membership_card' && <MembershipExtensionField />}
    </div>
  );
}
