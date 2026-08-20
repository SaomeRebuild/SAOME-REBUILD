/**
 * Step2CardSettings — 卡片設定操作區（Step 2 主體）
 *
 * 包含 Barcode 選擇、店名、發卡機構、有效天數、到期日、貨幣（Base 欄位，所有卡種共用）。
 */

import { BarcodeSelector } from './BarcodeSelector';
import { StoreNameField } from './StoreNameField';
import { IssuerNameField } from './IssuerNameField';
import { PassValidDaysField } from './PassValidDaysField';
import { ExpiryDateField } from './ExpiryDateField';
import { CurrencyField } from './CurrencyField';

interface Step2CardSettingsProps {
  showValidation?: boolean;
}

export function Step2CardSettings({ showValidation }: Step2CardSettingsProps) {
  return (
    <div className="space-y-6">
      <BarcodeSelector />
      <StoreNameField showValidation={showValidation} />
      <IssuerNameField showValidation={showValidation} />
      <PassValidDaysField />
      <ExpiryDateField />
      <CurrencyField />
    </div>
  );
}
