/**
 * BarcodeSelector — Barcode 格式選擇器（原生 HTML Radio）
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { BarcodePreview } from './BarcodePreview';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';

export function BarcodeSelector() {
  const { t } = useTranslation('cardEditor');
  const barcodeType = useCardBuilderStore((s) => s.barcodeType);
  const setBarcodeType = useCardBuilderStore((s) => s.setBarcodeType);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('step2.barcode.title')}</h3>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="barcodeType"
            value="qr_code"
            checked={barcodeType === 'qr_code'}
            onChange={() => setBarcodeType('qr_code' as BarcodeType)}
            className="h-4 w-4 cursor-pointer"
          />
          <span className="text-sm">{t('step2.barcode.qrCode')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="barcodeType"
            value="pdf_417"
            checked={barcodeType === 'pdf_417'}
            onChange={() => setBarcodeType('pdf_417' as BarcodeType)}
            className="h-4 w-4 cursor-pointer"
          />
          <span className="text-sm">{t('step2.barcode.pdf417')}</span>
        </label>
      </div>
      <BarcodePreview type={barcodeType} />
    </div>
  );
}
